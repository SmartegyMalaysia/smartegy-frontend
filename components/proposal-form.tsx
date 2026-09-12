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

type ReadingDraft = { month: string; monthNumber: string; year: string; bill: string; kwh: string };
type ReadingWarnings = { month: boolean; bill: boolean; kwh: boolean };
type ProposalInputWithDownpayment = ProposalInput & { downpaymentSen?: MoneySen | null };
type ProposalWarnings = { salesRepName: boolean; proposalDate: boolean; installationAddress: boolean; installationCost: boolean; outstationCost: boolean; saleAmount: boolean; downpayment: boolean; duplicateMonth: boolean; readings: ReadingWarnings[] };

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

const proposalMonthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const proposalMonthLabels = Object.fromEntries(proposalMonthOptions.map((month) => [month, new Intl.DateTimeFormat("en-MY", { month: "long", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(`2000-${month}-01T00:00:00`))]));

function initialReadings(caseDetail: CaseDetail): ReadingDraft[] {
  const saved = caseDetail.proposalReadings?.slice(0, 12) ?? [];
  if (!saved.length) return emptyProposalReadings().map(() => ({ month: "", monthNumber: "", year: "", bill: "", kwh: "" }));
  return saved.map((reading) => ({
    month: reading.month.match(/^\d{4}-\d{2}$/) ? reading.month : "",
    monthNumber: reading.month.match(/^\d{4}-(\d{2})$/)?.[1] ?? "",
    year: reading.month.match(/^(\d{4})-\d{2}$/)?.[1] ?? "",
    bill: reading.billAmountSen > 0 ? formatMoneyInput(reading.billAmountSen) : "",
    kwh: reading.kwhUsed > 0 ? String(reading.kwhUsed) : "",
  }));
}

function getProposalWarnings(salesRepName: string, proposalDate: string, installationAddress: string, installationCost: string, outstationCost: string, saleAmount: string, downpaymentAmount: string, readings: ReadingDraft[], calculatedDownpaymentSen: number | null): ProposalWarnings {
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
    installationAddress: !installationAddress.trim(),
    installationCost: !installationCost.trim() || !Number.isFinite(Number(installationCost)) || Number(installationCost) < 0,
    outstationCost: !outstationCost.trim() || !Number.isFinite(Number(outstationCost)) || Number(outstationCost) < 0,
    saleAmount: !saleAmount.trim() || !Number.isFinite(Number(saleAmount)) || Number(saleAmount) <= 0,
    downpayment: !effectiveDownpayment || !Number.isFinite(Number(effectiveDownpayment)) || Number(effectiveDownpayment) < 0,
    duplicateMonth,
    readings: readingWarnings,
  };
}

function firstProposalWarning(warnings: ProposalWarnings): string | null {
  if (warnings.salesRepName) return "Enter the sales representative name.";
  if (warnings.proposalDate) return "Choose a proposal date.";
  if (warnings.installationAddress) return "Enter the installation address.";
  if (warnings.installationCost) return "Enter a valid installation cost.";
  if (warnings.outstationCost) return "Enter a valid outstation cost.";
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

function buildInput(salesRepName: string, proposalDate: string, installationAddress: string, installationCost: string, outstationCost: string, saleAmount: string, downpaymentAmount: string, readings: ReadingDraft[]): ProposalInputWithDownpayment | null {
  const amount = Number(saleAmount);
  const installationCostValue = Number(installationCost);
  const outstationCostValue = Number(outstationCost);
  if (!salesRepName.trim() || !proposalDate || !installationAddress.trim() || !Number.isFinite(installationCostValue) || installationCostValue < 0 || !Number.isFinite(outstationCostValue) || outstationCostValue < 0 || !Number.isFinite(amount) || amount <= 0) return null;
  const parsed: ProposalEnergyReading[] = readings.map((reading, index) => {
    const billAmountSen = Math.round(Number(reading.bill) * 100);
    const kwhUsed = Number(reading.kwh);
    const operationDays = calendarDaysForMonth(reading.month) ?? 0;
    const tnbRate = billAmountSen / 100 / kwhUsed;
    return { sequence: index + 1, month: reading.month.trim(), tnbRate, kwhUsed, billAmountSen, operationDays, dailyKwh: operationDays > 0 ? kwhUsed / operationDays : undefined };
  });
  if (parsed.some((reading) => !reading.month || !Number.isFinite(reading.tnbRate) || !Number.isFinite(reading.kwhUsed) || !Number.isFinite(reading.billAmountSen) || !Number.isFinite(reading.operationDays) || reading.operationDays < 1)) return null;
  const input: ProposalInputWithDownpayment = { salesRepName: salesRepName.trim(), proposalDate, installationAddress: installationAddress.trim(), installationCostSen: Math.round(installationCostValue * 100), outstationCostSen: Math.round(outstationCostValue * 100), saleAmountSen: Math.round(amount * 100), readings: parsed };
  if (downpaymentAmount.trim()) {
    const downpayment = Number(downpaymentAmount);
    input.downpaymentSen = Number.isFinite(downpayment) ? Math.round(downpayment * 100) : Number.NaN;
  }
  return input;
}

export function ProposalForm({ caseDetail, user, onChanged, onClose }: { caseDetail: CaseDetail; user: CurrentUser; onChanged: (value: CaseDetail) => void; onClose: () => void }) {
  const [salesRepName, setSalesRepName] = useState(caseDetail.proposal?.salesRepName ?? user.displayName);
  const [proposalDate, setProposalDate] = useState(caseDetail.proposal?.proposalDate ?? new Date().toISOString().slice(0, 10));
  const installationAddress = caseDetail.service.siteAddress;
  const [installationCost, setInstallationCost] = useState(caseDetail.proposal ? formatMoneyInput(caseDetail.proposal.installationCostSen) : "0.00");
  const [outstationCost, setOutstationCost] = useState(caseDetail.proposal ? formatMoneyInput(caseDetail.proposal.outstationCostSen) : "0.00");
  const [saleAmount, setSaleAmount] = useState(caseDetail.proposal ? String(caseDetail.proposal.saleAmountSen / 100) : caseDetail.saleAmountSen ? String(caseDetail.saleAmountSen / 100) : "");
  const [downpaymentAmount, setDownpaymentAmount] = useState(caseDetail.proposal ? formatMoneyInput(caseDetail.proposal.deposit1Sen) : "");
  const [projectRemarks, setProjectRemarks] = useState(caseDetail.service.notes ?? "");
  const [readings, setReadings] = useState<ReadingDraft[]>(() => initialReadings(caseDetail));
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const monthOptions = useMemo(() => getHistoricalMonthOptions(), []);
  const baseInput = useMemo(() => buildInput(salesRepName, proposalDate, installationAddress, installationCost, outstationCost, saleAmount, "", readings), [salesRepName, proposalDate, installationAddress, installationCost, outstationCost, saleAmount, readings]);
  const basePreview = useMemo(() => baseInput ? calculateProposalPreview(baseInput) : null, [baseInput]);
  const input = useMemo(() => buildInput(salesRepName, proposalDate, installationAddress, installationCost, outstationCost, saleAmount, downpaymentAmount, readings), [salesRepName, proposalDate, installationAddress, installationCost, outstationCost, saleAmount, downpaymentAmount, readings]);
  const preview = useMemo(() => input ? calculateProposalPreview(input) : null, [input]);
  const displayPreview = preview ?? basePreview;
  const downpaymentDisplay = downpaymentAmount.trim() || (basePreview ? formatMoneyInput(basePreview.calculatedDownpaymentSen) : "");
  const fieldWarnings = useMemo(() => getProposalWarnings(salesRepName, proposalDate, installationAddress, installationCost, outstationCost, saleAmount, downpaymentAmount, readings, basePreview?.calculatedDownpaymentSen ?? null), [salesRepName, proposalDate, installationAddress, installationCost, outstationCost, saleAmount, downpaymentAmount, readings, basePreview]);
  const validationWarning = useMemo(() => firstProposalWarning(fieldWarnings), [fieldWarnings]);

  function updateReading(index: number, key: keyof ReadingDraft, value: string) {
    setWarning(null);
    setReadings((current) => current.map((reading, readingIndex) => {
      if (readingIndex !== index) return reading;
      const next = { ...reading, [key]: value };
      if (key === "monthNumber" || key === "year") next.month = next.year && next.monthNumber ? `${next.year}-${next.monthNumber}` : "";
      return next;
    }));
  }

  function addReading() {
    if (readings.length >= 12) return;
    setWarning(null);
    setReadings((current) => {
      const previousMonth = current[current.length - 1]?.month ?? "";
      const usedMonths = new Set(current.map((reading) => reading.month).filter(Boolean));
      let nextMonth = "";
      const previousMatch = previousMonth.match(/^(\d{4})-(\d{2})$/);
      if (previousMatch) {
        const cursor = new Date(Date.UTC(Number(previousMatch[1]), Number(previousMatch[2]) - 1 + 1, 1));
        for (let attempt = 0; attempt < 1200; attempt += 1) {
          const candidate = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
          if (monthOptions.includes(candidate) && !usedMonths.has(candidate)) { nextMonth = candidate; break; }
          cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
      }
      return [...current, { month: nextMonth, monthNumber: nextMonth.slice(5, 7), year: nextMonth.slice(0, 4), bill: "", kwh: "" }];
    });
  }

  function removeLastReading() {
    if (readings.length <= 1) return;
    setWarning(null);
    setReadings((current) => current.slice(0, -1));
  }

  async function save(issue: boolean) {
    setShowWarnings(true);
    if (validationWarning) { setWarning(validationWarning); return; }
    if (!input) { setWarning("Complete the proposal details, additional costs, project amount, and every reading row."); return; }
    if (!preview) { setWarning("The initial payment obligation cannot exceed the sale amount, and the downpayment must be valid."); return; }
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
        <div className="case-field proposal-service-address-field"><label htmlFor="proposal-service-address">Service Address</label><div id="proposal-service-address" className="proposal-service-address-value">{caseDetail.service.siteAddress || "Not provided"}</div></div>
        <ReadOnlyField id="proposal-contact-person" title="Contact Person" value={caseDetail.customer.contactName ?? "Not provided"} />
        <ReadOnlyField id="proposal-customer-email" title="Contact Email" value={caseDetail.customer.email ?? "Not provided"} />
        <TextInput title="Sales Representative" value={salesRepName} onChange={(event) => setSalesRepName(event.target.value)} required fieldClassName={showWarnings && fieldWarnings.salesRepName ? "case-field-warning" : ""} />
        <DatePicker id="proposal-date" title="Proposal Date" value={proposalDate} onChange={setProposalDate} required fieldClassName={showWarnings && fieldWarnings.proposalDate ? "case-field-warning" : ""} />
        <TextInput prefix="RM" id="proposal-sale-amount" title="Sale Amount" inputMode="decimal" value={saleAmount} onChange={(event) => setSaleAmount(event.target.value)} required aria-invalid={showWarnings && fieldWarnings.saleAmount} fieldClassName={showWarnings && (fieldWarnings.saleAmount || (Boolean(input) && !preview)) ? "case-field-warning" : ""} />
        <TextInput prefix="RM" id="proposal-installation-cost" title="Installation Cost" inputMode="decimal" value={installationCost} onChange={(event) => setInstallationCost(event.target.value)} required aria-invalid={showWarnings && fieldWarnings.installationCost} fieldClassName={showWarnings && fieldWarnings.installationCost ? "case-field-warning" : ""} />
        <TextInput prefix="RM" id="proposal-outstation-cost" title="Outstation Cost" inputMode="decimal" value={outstationCost} onChange={(event) => setOutstationCost(event.target.value)} required aria-invalid={showWarnings && fieldWarnings.outstationCost} fieldClassName={showWarnings && fieldWarnings.outstationCost ? "case-field-warning" : ""} />
        <TextArea title="Project Remarks" value={projectRemarks} onChange={(event) => setProjectRemarks(event.target.value)} placeholder="Add project-specific remarks" />
      </div>
      <section className="proposal-readings-section">
        <div className="proposal-section-heading"><div><h3>TNB Readings</h3><p>Start with one completed historical month. Add up to twelve rows; days are fixed from the selected calendar month.</p></div></div>
        <div className="proposal-readings-table">
          <div className="proposal-reading-row proposal-reading-header"><span>Month</span><span>Year</span><span>Bill (RM)</span><span>kWh Used</span><span>TNB Rate</span><span>Days</span><span>Daily kWh</span></div>
          {readings.map((reading, index) => {
            const days = calendarDaysForMonth(reading.month);
            const readingWarnings = fieldWarnings.readings[index];
            const availableMonths = monthOptions.filter((option) => option === reading.month || !readings.some((other, otherIndex) => otherIndex !== index && other.month === option));
            const availableMonthNumbers = proposalMonthOptions.filter((month) => availableMonths.some((option) => option.endsWith(`-${month}`)));
            return <div className="proposal-reading-row" key={index}>
              <FilterSelect id={`proposal-month-${index + 1}`} ariaLabel={`Month ${index + 1}`} allLabel="Select month" value={reading.monthNumber} options={availableMonthNumbers} labels={proposalMonthLabels} onChange={(value) => updateReading(index, "monthNumber", value)} required ariaInvalid={showWarnings && readingWarnings.month} />
              <TextInput id={`proposal-year-${index + 1}`} aria-label={`Year ${index + 1}`} placeholder="YYYY" inputMode="numeric" maxLength={4} value={reading.year} onChange={(event) => updateReading(index, "year", event.target.value.replace(/\D/g, "").slice(0, 4))} className={showWarnings && readingWarnings.month ? "proposal-warning-field" : ""} required />
              <TextInput prefix="RM" aria-label={`Bill amount in RM ${index + 1}`} placeholder="1300" inputMode="decimal" className={showWarnings && readingWarnings.bill ? "proposal-warning-field" : ""} value={reading.bill} onChange={(event) => updateReading(index, "bill", event.target.value)} />
              <TextInput aria-label={`kWh used ${index + 1}`} placeholder="e.g. 2600" inputMode="decimal" className={showWarnings && readingWarnings.kwh ? "proposal-warning-field" : ""} value={reading.kwh} onChange={(event) => updateReading(index, "kwh", event.target.value)} />
              <span className="proposal-reading-calculated" aria-label={`Calculated TNB rate ${index + 1}`}>{formatRate(reading.bill, reading.kwh)}</span>
              <span className="proposal-reading-calculated" aria-label={`Calendar days ${index + 1}`}>{days ?? "—"}</span>
              <span className="proposal-reading-calculated" aria-label={`Daily kWh ${index + 1}`}>{days && Number.isFinite(Number(reading.kwh)) && Number(reading.kwh) > 0 ? (Number(reading.kwh) / days).toFixed(3) : "—"}</span>
            </div>;
          })}
        </div>
        <div className="proposal-form-actions proposal-reading-actions"><Button type="button" variant="secondary" size="sm" onClick={removeLastReading} disabled={busy || readings.length <= 1}>Remove Month</Button><Button type="button" variant="secondary" size="sm" onClick={addReading} disabled={busy || readings.length >= 12}>Add Month</Button></div>
      </section>
      <section className="proposal-preview-section">
        <div className="proposal-section-heading"><div><h3>Calculated Preview</h3><p>Final values are recalculated and validated by the system.</p></div></div>
        {displayPreview ? <dl className="proposal-preview-grid"><div><dt>Average Bill</dt><dd>{formatMoney(displayPreview.avgBillSen)}</dd></div><div><dt>Calculated Savings/ Suggested Downpayment</dt><dd>{formatMoney(displayPreview.calculatedDownpaymentSen)}</dd></div><div className="proposal-preview-downpayment"><dt>Downpayment</dt><dd><MoneyInput id="proposal-downpayment" inputMode="decimal" value={downpaymentDisplay} onChange={(event) => setDownpaymentAmount(event.target.value)} required aria-invalid={showWarnings && fieldWarnings.downpayment} fieldClassName={showWarnings && fieldWarnings.downpayment ? "case-field-warning" : ""} /></dd></div><div><dt>Post-Installation</dt><dd>{formatMoney(displayPreview.postInstallationSen)}</dd></div><div><dt>Balance</dt><dd>{formatMoney(displayPreview.balanceSen)}</dd></div><div><dt>10-Month Option</dt><dd>{formatMoney(displayPreview.option1MonthlySen)} / month</dd></div><div><dt>20-Month Option</dt><dd>{formatMoney(displayPreview.option2MonthlySen)} / month</dd></div><div><dt>Annual Saving</dt><dd>{formatMoney(displayPreview.savingRmYearSen)}</dd></div></dl> : <p className="detail-empty">Complete the required values to see the calculation preview.</p>}
      </section>
      {warning && <p className="proposal-warning" role="alert">⚠ {warning}</p>}
      <div className="proposal-form-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="button" variant="secondary" onClick={() => save(false)} disabled={busy}>{busy ? "Saving…" : "Save Draft"}</Button><Button type="button" variant="primary" onClick={() => save(true)} disabled={busy}>{busy ? "Issuing…" : "Issue Proposal"}</Button></div>
    </div>
  </PopupModal>;
}
