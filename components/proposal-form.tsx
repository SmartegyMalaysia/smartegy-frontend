"use client";

import { useMemo, useState } from "react";
import { Button } from "./ui";
import { FilterSelect } from "./filter-select";
import { MoneyInput, ReadOnlyField, TextArea, TextInput } from "./form-controls";
import { DatePicker } from "./date-picker";
import { PopupModal } from "./popup-modal";
import { casesRepository } from "@/lib/case-repository";
import { calendarDaysForMonth, calculateProposalPreview, emptyProposalReadings, isCompletedHistoricalMonth } from "@/lib/proposal-calculations";
import { formatMoney } from "@/lib/format";
import type { CaseDetail, CurrentUser, MoneySen, ProposalEnergyReading, ProposalInput } from "@/lib/types";

type ReadingDraft = { month: string; bill: string; kwh: string };
type ReadingWarnings = { month: boolean; bill: boolean; kwh: boolean };
type ProposalInputWithDownpayment = ProposalInput & { downpaymentSen?: MoneySen | null };
type ProposalWarnings = { salesRepName: boolean; proposalDate: boolean; saleAmount: boolean; downpayment: boolean; duplicateMonth: boolean; readings: ReadingWarnings[] };

function formatMoneyInput(sen: number) {
  return (sen / 100).toFixed(2);
}

function formatRate(bill: string, kwh: string) {
  const billValue = Number(bill);
  const kwhValue = Number(kwh);
  if (!bill.trim() || !kwh.trim() || !Number.isFinite(billValue) || !Number.isFinite(kwhValue) || billValue <= 0 || kwhValue <= 0) return "—";
  return (billValue / kwhValue).toFixed(6);
}

function getHistoricalMonthOptions() {
  const options: string[] = [];
  const today = new Date();
  const cursor = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const firstMonth = new Date(1900, 0, 1);
  while (cursor >= firstMonth) {
    options.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return options;
}

function monthLabels(options: string[]) {
  return Object.fromEntries(options.map((option) => [option, new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(`${option}-01T00:00:00`))]));
}

function initialReadings(caseDetail: CaseDetail): ReadingDraft[] {
  const saved = caseDetail.proposalReadings?.slice(0, 12) ?? [];
  if (!saved.length) return emptyProposalReadings().map(() => ({ month: "", bill: "", kwh: "" }));
  return saved.map((reading) => ({
    month: reading.month.match(/^\d{4}-\d{2}$/) ? reading.month : "",
    bill: reading.billAmountSen > 0 ? formatMoneyInput(reading.billAmountSen) : "",
    kwh: reading.kwhUsed > 0 ? String(reading.kwhUsed) : "",
  }));
}

function getProposalWarnings(salesRepName: string, proposalDate: string, saleAmount: string, downpaymentAmount: string, readings: ReadingDraft[], calculatedDownpaymentSen: number | null): ProposalWarnings {
  const effectiveDownpayment = downpaymentAmount.trim() || (calculatedDownpaymentSen === null ? "" : formatMoneyInput(calculatedDownpaymentSen));
  const seenMonths = new Set<string>();
  let duplicateMonth = false;
  const readingWarnings = readings.map((reading) => {
    if (reading.month && seenMonths.has(reading.month)) duplicateMonth = true;
    if (reading.month) seenMonths.add(reading.month);
    return {
      month: !isCompletedHistoricalMonth(reading.month),
      bill: !reading.bill.trim() || !Number.isFinite(Number(reading.bill)) || Number(reading.bill) <= 0,
      kwh: !reading.kwh.trim() || !Number.isFinite(Number(reading.kwh)) || Number(reading.kwh) <= 0,
    };
  });
  return {
    salesRepName: !salesRepName.trim(),
    proposalDate: !proposalDate,
    saleAmount: !saleAmount.trim() || !Number.isFinite(Number(saleAmount)) || Number(saleAmount) <= 0,
    downpayment: !effectiveDownpayment || !Number.isFinite(Number(effectiveDownpayment)) || Number(effectiveDownpayment) < 0,
    duplicateMonth,
    readings: readingWarnings,
  };
}

function firstProposalWarning(warnings: ProposalWarnings): string | null {
  if (warnings.salesRepName) return "Enter the sales representative name.";
  if (warnings.proposalDate) return "Choose a proposal date.";
  if (warnings.saleAmount) return "Enter a sale amount greater than RM 0.";
  const readingIndex = warnings.readings.findIndex((reading) => reading.month || reading.bill || reading.kwh);
  const firstReadingIndex = readingIndex < 0 ? 0 : readingIndex;
  const reading = warnings.readings[firstReadingIndex];
  if (reading.month) return `Choose a completed historical month for reading ${firstReadingIndex + 1}.`;
  if (warnings.duplicateMonth) return "Each reading must use a different month and year.";
  if (reading.bill) return `Enter a bill amount greater than RM 0 for reading ${firstReadingIndex + 1}.`;
  if (reading.kwh) return `Enter the kWh used for reading ${firstReadingIndex + 1}.`;
  if (warnings.downpayment) return "Enter a valid downpayment amount.";
  return null;
}

function buildInput(salesRepName: string, proposalDate: string, saleAmount: string, downpaymentAmount: string, readings: ReadingDraft[]): ProposalInputWithDownpayment | null {
  const amount = Number(saleAmount);
  if (!salesRepName.trim() || !proposalDate || !Number.isFinite(amount) || amount <= 0) return null;
  const parsed: ProposalEnergyReading[] = readings.map((reading, index) => {
    const billAmountSen = Math.round(Number(reading.bill) * 100);
    const kwhUsed = Number(reading.kwh);
    const operationDays = calendarDaysForMonth(reading.month) ?? 0;
    const tnbRate = billAmountSen / 100 / kwhUsed;
    return { sequence: index + 1, month: reading.month.trim(), tnbRate, kwhUsed, billAmountSen, operationDays, dailyKwh: operationDays > 0 ? kwhUsed / operationDays : undefined };
  });
  if (parsed.some((reading) => !reading.month || !Number.isFinite(reading.tnbRate) || !Number.isFinite(reading.kwhUsed) || !Number.isFinite(reading.billAmountSen) || !Number.isFinite(reading.operationDays) || reading.operationDays < 1)) return null;
  const input: ProposalInputWithDownpayment = { salesRepName: salesRepName.trim(), proposalDate, saleAmountSen: Math.round(amount * 100), readings: parsed };
  if (downpaymentAmount.trim()) {
    const downpayment = Number(downpaymentAmount);
    input.downpaymentSen = Number.isFinite(downpayment) ? Math.round(downpayment * 100) : Number.NaN;
  }
  return input;
}

export function ProposalForm({ caseDetail, user, onChanged, onClose }: { caseDetail: CaseDetail; user: CurrentUser; onChanged: (value: CaseDetail) => void; onClose: () => void }) {
  const [salesRepName, setSalesRepName] = useState(caseDetail.proposal?.salesRepName ?? user.displayName);
  const [proposalDate, setProposalDate] = useState(caseDetail.proposal?.proposalDate ?? new Date().toISOString().slice(0, 10));
  const [saleAmount, setSaleAmount] = useState(caseDetail.proposal ? String(caseDetail.proposal.saleAmountSen / 100) : caseDetail.saleAmountSen ? String(caseDetail.saleAmountSen / 100) : "");
  const [downpaymentAmount, setDownpaymentAmount] = useState(caseDetail.proposal ? formatMoneyInput(caseDetail.proposal.deposit1Sen) : "");
  const [projectRemarks, setProjectRemarks] = useState(caseDetail.service.notes ?? "");
  const [readings, setReadings] = useState<ReadingDraft[]>(() => initialReadings(caseDetail));
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const monthOptions = useMemo(() => getHistoricalMonthOptions(), []);
  const labels = useMemo(() => monthLabels(monthOptions), [monthOptions]);
  const baseInput = useMemo(() => buildInput(salesRepName, proposalDate, saleAmount, "", readings), [salesRepName, proposalDate, saleAmount, readings]);
  const basePreview = useMemo(() => baseInput ? calculateProposalPreview(baseInput) : null, [baseInput]);
  const input = useMemo(() => buildInput(salesRepName, proposalDate, saleAmount, downpaymentAmount, readings), [salesRepName, proposalDate, saleAmount, downpaymentAmount, readings]);
  const preview = useMemo(() => input ? calculateProposalPreview(input) : null, [input]);
  const downpaymentDisplay = downpaymentAmount.trim() || (basePreview ? formatMoneyInput(basePreview.calculatedDownpaymentSen) : "");
  const fieldWarnings = useMemo(() => getProposalWarnings(salesRepName, proposalDate, saleAmount, downpaymentAmount, readings, basePreview?.calculatedDownpaymentSen ?? null), [salesRepName, proposalDate, saleAmount, downpaymentAmount, readings, basePreview]);
  const validationWarning = useMemo(() => firstProposalWarning(fieldWarnings), [fieldWarnings]);
  const commissionFloorInvalid = Boolean(input && preview && input.saleAmountSen < preview.minimumSaleAmountSen);

  function updateReading(index: number, key: keyof ReadingDraft, value: string) {
    setWarning(null);
    setReadings((current) => current.map((reading, readingIndex) => readingIndex === index ? { ...reading, [key]: value } : reading));
  }

  function addReading() {
    if (readings.length >= 12) return;
    setWarning(null);
    setReadings((current) => [...current, { month: "", bill: "", kwh: "" }]);
  }

  function removeLastReading() {
    if (readings.length <= 1) return;
    setWarning(null);
    setReadings((current) => current.slice(0, -1));
  }

  async function save(issue: boolean) {
    setShowWarnings(true);
    if (validationWarning) { setWarning(validationWarning); return; }
    if (!input) { setWarning("Complete the sales representative, sale amount, date, and every reading row."); return; }
    if (!preview) { setWarning("The initial payment obligation cannot exceed the sale amount, and the downpayment must be valid."); return; }
    if (commissionFloorInvalid) { setWarning(`Sale Amount must be at least ${formatMoney(preview.minimumSaleAmountSen)} to prevent negative commissions.`); return; }
    setBusy(true); setWarning(null);
    const result = issue ? await casesRepository.issueProposal(user, caseDetail.id, input) : await casesRepository.saveProposalDraft(user, caseDetail.id, input);
    if (result.ok) {
      const remarksChanged = (caseDetail.service.notes ?? "") !== (projectRemarks.trim() || "");
      const remarksResult = remarksChanged
        ? await casesRepository.update(user, caseDetail.id, { service: { notes: projectRemarks.trim() || null } })
        : result;
      if (!remarksResult.ok) {
        onChanged(result.data);
        setWarning(`Proposal saved, but Project Remarks could not be updated: ${remarksResult.error.message}`);
      } else {
        onChanged(remarksResult.data);
        if (issue) onClose(); else setWarning(null);
      }
    } else setWarning(result.error.message);
    setBusy(false);
  }

  return <PopupModal open title="Prepare Proposal" description="Review the customer details, historical TNB readings, and server-calculated payment values before issuing the proposal." size="lg" className="proposal-dialog" onClose={onClose} hasUnsavedChanges={!busy} closeOnBackdrop={false}>
    <div className="proposal-form">
      <div className="proposal-form-grid">
        <ReadOnlyField id="proposal-customer" title="Customer" value={caseDetail.customer.displayName} />
        <ReadOnlyField id="proposal-service-address" title="Service Address" value={caseDetail.service.siteAddress || "Not provided"} multiline />
        <ReadOnlyField id="proposal-contact-person" title="Contact Person" value={caseDetail.customer.contactName ?? "Not provided"} />
        <ReadOnlyField id="proposal-customer-email" title="Contact Email" value={caseDetail.customer.email ?? "Not provided"} />
        <TextInput title="Sales Representative" value={salesRepName} onChange={(event) => setSalesRepName(event.target.value)} required fieldClassName={showWarnings && fieldWarnings.salesRepName ? "case-field-warning" : ""} />
        <DatePicker id="proposal-date" title="Proposal Date" value={proposalDate} onChange={setProposalDate} required fieldClassName={showWarnings && fieldWarnings.proposalDate ? "case-field-warning" : ""} />
        <div className="proposal-project-value-field">
          <MoneyInput id="proposal-sale-amount" title="Sale Amount" inputMode="decimal" value={saleAmount} onChange={(event) => setSaleAmount(event.target.value)} required aria-invalid={showWarnings && commissionFloorInvalid} aria-describedby={preview ? "proposal-sale-amount-minimum" : undefined} fieldClassName={showWarnings && (fieldWarnings.saleAmount || (Boolean(input) && !preview) || commissionFloorInvalid) ? "case-field-warning" : ""} />
          {preview && <p id="proposal-sale-amount-minimum" className={`proposal-project-value-hint${showWarnings && commissionFloorInvalid ? " proposal-project-value-hint-error" : ""}`}>Minimum for non-negative commissions: {formatMoney(preview.minimumSaleAmountSen)}</p>}
        </div>
        <div className="proposal-project-value-field">
          <MoneyInput id="proposal-downpayment" title="Downpayment" inputMode="decimal" value={downpaymentDisplay} onChange={(event) => setDownpaymentAmount(event.target.value)} required aria-invalid={showWarnings && fieldWarnings.downpayment} fieldClassName={showWarnings && fieldWarnings.downpayment ? "case-field-warning" : ""} />
          {basePreview && <p className="proposal-project-value-hint">Calculated default: {formatMoney(basePreview.calculatedDownpaymentSen)}</p>}
        </div>
        <TextArea title="Project Remarks" value={projectRemarks} onChange={(event) => setProjectRemarks(event.target.value)} placeholder="Add project-specific remarks" />
      </div>
      <section className="proposal-readings-section">
        <div className="proposal-section-heading"><div><h3>TNB Readings</h3><p>Start with one completed historical month. Add up to twelve rows; days are fixed from the selected calendar month.</p></div></div>
        <div className="proposal-readings-table">
          <div className="proposal-reading-row proposal-reading-header"><span>#</span><span>Month &amp; Year</span><span>Bill (RM)</span><span>kWh Used</span><span>TNB Rate</span><span>Days</span><span>Daily kWh</span></div>
          {readings.map((reading, index) => {
            const days = calendarDaysForMonth(reading.month);
            const readingWarnings = fieldWarnings.readings[index];
            const availableMonths = monthOptions.filter((option) => option === reading.month || !readings.some((other, otherIndex) => otherIndex !== index && other.month === option));
            return <div className="proposal-reading-row" key={index}>
              <span>{index + 1}</span>
              <FilterSelect id={`proposal-month-${index + 1}`} ariaLabel={`Month and year ${index + 1}`} allLabel="Select month and year" value={reading.month} options={availableMonths} labels={labels} onChange={(value) => updateReading(index, "month", value)} required ariaInvalid={showWarnings && readingWarnings.month} />
              <MoneyInput aria-label={`Bill amount in RM ${index + 1}`} placeholder="e.g. 1300" inputMode="decimal" className={showWarnings && readingWarnings.bill ? "proposal-warning-field" : ""} value={reading.bill} onChange={(event) => updateReading(index, "bill", event.target.value)} />
              <TextInput aria-label={`kWh used ${index + 1}`} placeholder="e.g. 2600" inputMode="decimal" className={showWarnings && readingWarnings.kwh ? "proposal-warning-field" : ""} value={reading.kwh} onChange={(event) => updateReading(index, "kwh", event.target.value)} />
              <span className="proposal-reading-calculated" aria-label={`Calculated TNB rate ${index + 1}`}>{formatRate(reading.bill, reading.kwh)}</span>
              <span className="proposal-reading-calculated" aria-label={`Calendar days ${index + 1}`}>{days ?? "—"}</span>
              <span className="proposal-reading-calculated" aria-label={`Daily kWh ${index + 1}`}>{days && Number.isFinite(Number(reading.kwh)) && Number(reading.kwh) > 0 ? (Number(reading.kwh) / days).toFixed(3) : "—"}</span>
            </div>;
          })}
        </div>
        <div className="proposal-form-actions"><Button type="button" variant="secondary" size="sm" onClick={removeLastReading} disabled={busy || readings.length <= 1}>Remove Last Row</Button><Button type="button" variant="secondary" size="sm" onClick={addReading} disabled={busy || readings.length >= 12}>Add Month ({readings.length}/12)</Button></div>
      </section>
      <section className="proposal-preview-section">
        <div className="proposal-section-heading"><div><h3>Calculated Preview</h3><p>Final values are recalculated and validated by the system.</p></div></div>
        {preview ? <dl className="proposal-preview-grid"><div><dt>Average Bill</dt><dd>{formatMoney(preview.avgBillSen)}</dd></div><div><dt>Monthly Saving</dt><dd>{formatMoney(preview.savingRmMonthSen)}</dd></div><div><dt>Calculated Downpayment</dt><dd>{formatMoney(preview.calculatedDownpaymentSen)}</dd></div><div><dt>Final Downpayment</dt><dd>{formatMoney(preview.downpaymentSen)}</dd></div><div><dt>Post-Installation</dt><dd>{formatMoney(preview.postInstallationSen)}</dd></div><div><dt>Balance</dt><dd>{formatMoney(preview.balanceSen)}</dd></div><div><dt>Financing Interest</dt><dd>{formatMoney(preview.financingInterestSen)}</dd></div><div><dt>10-Month Total</dt><dd>{formatMoney(preview.option1TotalSen)}</dd></div><div><dt>10-Month Option</dt><dd>{formatMoney(preview.option1MonthlySen)} / month</dd></div><div><dt>20-Month Total</dt><dd>{formatMoney(preview.option2TotalSen)}</dd></div><div><dt>20-Month Option</dt><dd>{formatMoney(preview.option2MonthlySen)} / month</dd></div><div><dt>Annual Saving</dt><dd>{formatMoney(preview.savingRmYearSen)}</dd></div></dl> : <p className="detail-empty">Complete the required values to see the calculation preview.</p>}
      </section>
      {warning && <p className="proposal-warning" role="alert">⚠ {warning}</p>}
      <div className="proposal-form-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="button" variant="secondary" onClick={() => save(false)} disabled={busy}>{busy ? "Saving…" : "Save Draft"}</Button><Button type="button" variant="primary" onClick={() => save(true)} disabled={busy}>{busy ? "Issuing…" : "Issue Proposal"}</Button></div>
    </div>
  </PopupModal>;
}
