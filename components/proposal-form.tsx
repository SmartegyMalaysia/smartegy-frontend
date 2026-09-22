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
type ReadingErrors = { month?: string; bill?: string; kwh?: string };
type ProposalInputWithDownpayment = ProposalInput & { downpaymentSen?: MoneySen | null };
type ProposalErrors = { salesRepName?: string; proposalDate?: string; installationAddress?: string; installationCost?: string; outstationCost?: string; saleAmount?: string; downpayment?: string; readings: ReadingErrors[] };

const MAX_MONEY_DECIMAL_PLACES = 2;
const MAX_KWH_DECIMAL_PLACES = 3;
const MAX_MONEY_SEN = 99999999999999;
const MAX_KWH = 99999999999.999;

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

function decimalFieldError(value: string, label: string, decimals: number, minimum: number, maximum: number, required: boolean): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return required ? `${label} is required.` : undefined;
  if (!/^\d+(?:\.\d+)?$/.test(trimmed) || !Number.isFinite(Number(trimmed))) return `${label} must be a valid number.`;
  const decimalPlaces = trimmed.split(".")[1]?.length ?? 0;
  if (decimalPlaces > decimals) return `${label} can have up to ${decimals} decimal place${decimals === 1 ? "" : "s"}.`;
  const numericValue = Number(trimmed);
  if (numericValue < minimum) return `${label} must be ${minimum === 0 ? "zero or greater" : `at least ${minimum}`}.`;
  if (numericValue > maximum) return `${label} is too large.`;
  return undefined;
}

function dateFieldError(value: string): string | undefined {
  if (!value) return "Proposal date is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter a valid proposal date.";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return "Enter a valid proposal date.";
  return undefined;
}

function getProposalErrors(salesRepName: string, proposalDate: string, installationAddress: string, installationCost: string, outstationCost: string, saleAmount: string, downpaymentAmount: string, readings: ReadingDraft[], calculatedDownpaymentSen: number | null): ProposalErrors {
  const errors: ProposalErrors = {
    salesRepName: undefined,
    proposalDate: dateFieldError(proposalDate),
    installationAddress: installationAddress.trim() ? undefined : "Installation address is required.",
    installationCost: decimalFieldError(installationCost, "Installation cost", MAX_MONEY_DECIMAL_PLACES, 0, MAX_MONEY_SEN / 100, false),
    outstationCost: decimalFieldError(outstationCost, "Outstation cost", MAX_MONEY_DECIMAL_PLACES, 0, MAX_MONEY_SEN / 100, false),
    saleAmount: decimalFieldError(saleAmount, "Sale amount", MAX_MONEY_DECIMAL_PLACES, 0.01, MAX_MONEY_SEN / 100, true),
    readings: [],
  };
  const seenMonths = new Set<string>();
  errors.readings = readings.map((reading) => {
    const readingErrors: ReadingErrors = {};
    if (!reading.month || !isCompletedHistoricalMonth(reading.month)) readingErrors.month = "Choose a completed historical month.";
    else if (seenMonths.has(reading.month)) readingErrors.month = "This month is already used in another row.";
    else seenMonths.add(reading.month);
    readingErrors.bill = decimalFieldError(reading.bill, "Bill amount", MAX_MONEY_DECIMAL_PLACES, 0.01, MAX_MONEY_SEN / 100, true);
    readingErrors.kwh = decimalFieldError(reading.kwh, "kWh used", MAX_KWH_DECIMAL_PLACES, 0.001, MAX_KWH, true);
    return readingErrors;
  });

  const parsedDownpayment = downpaymentAmount.trim() ? Number(downpaymentAmount) : calculatedDownpaymentSen === null ? Number.NaN : calculatedDownpaymentSen / 100;
  errors.downpayment = decimalFieldError(downpaymentAmount, "Downpayment", MAX_MONEY_DECIMAL_PLACES, 0, MAX_MONEY_SEN / 100, false);
  if (!downpaymentAmount.trim() && calculatedDownpaymentSen === null) errors.downpayment = "Enter a valid downpayment amount or complete the readings first.";
  if (errors.downpayment === undefined && Number.isFinite(parsedDownpayment) && Number.isFinite(Number(saleAmount))) {
    const saleAmountSen = Math.round(Number(saleAmount) * 100);
    const downpaymentSen = Math.round(parsedDownpayment * 100);
    if (downpaymentSen * 3 > saleAmountSen) errors.downpayment = "Downpayment and post-installation payment cannot exceed the sale amount.";
  }
  return errors;
}

function firstProposalError(errors: ProposalErrors): string | null {
  if (errors.salesRepName) return errors.salesRepName;
  if (errors.proposalDate) return errors.proposalDate;
  if (errors.installationAddress) return errors.installationAddress;
  if (errors.installationCost) return errors.installationCost;
  if (errors.outstationCost) return errors.outstationCost;
  if (errors.saleAmount) return errors.saleAmount;
  const readingIndex = errors.readings.findIndex((reading) => reading.month || reading.bill || reading.kwh);
  const firstReadingIndex = readingIndex < 0 ? 0 : readingIndex;
  const reading = errors.readings[firstReadingIndex];
  if (reading?.month) return `Reading ${firstReadingIndex + 1}: ${reading.month}`;
  if (reading?.bill) return `Reading ${firstReadingIndex + 1}: ${reading.bill}`;
  if (reading?.kwh) return `Reading ${firstReadingIndex + 1}: ${reading.kwh}`;
  if (errors.downpayment) return errors.downpayment;
  return null;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="case-field-error-message" role="alert">{message}</p> : null;
}

function buildInput(salesRepName: string, proposalDate: string, installationAddress: string, installationCost: string, outstationCost: string, saleAmount: string, downpaymentAmount: string, readings: ReadingDraft[]): ProposalInputWithDownpayment | null {
  const amount = Number(saleAmount);
  const installationCostValue = Number(installationCost);
  const outstationCostValue = Number(outstationCost);
  if (!proposalDate || !installationAddress.trim() || !Number.isFinite(installationCostValue) || installationCostValue < 0 || !Number.isFinite(outstationCostValue) || outstationCostValue < 0 || !Number.isFinite(amount) || amount <= 0) return null;
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
  const [installationAddress, setInstallationAddress] = useState(caseDetail.proposal?.installationAddress ?? caseDetail.service.siteAddress);
  const [installationCost, setInstallationCost] = useState(caseDetail.proposal?.installationCostSen ? formatMoneyInput(caseDetail.proposal.installationCostSen) : "");
  const [outstationCost, setOutstationCost] = useState(caseDetail.proposal?.outstationCostSen ? formatMoneyInput(caseDetail.proposal.outstationCostSen) : "");
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
  const fieldErrors = useMemo(() => getProposalErrors(salesRepName, proposalDate, installationAddress, installationCost, outstationCost, saleAmount, downpaymentAmount, readings, basePreview?.calculatedDownpaymentSen ?? null), [salesRepName, proposalDate, installationAddress, installationCost, outstationCost, saleAmount, downpaymentAmount, readings, basePreview]);
  const validationWarning = useMemo(() => firstProposalError(fieldErrors), [fieldErrors]);
  const isReadingWarning = Boolean(warning?.startsWith("Reading "));
  const isDownpaymentWarning = Boolean(warning?.toLowerCase().includes("downpayment"));

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
        <div className="proposal-editable-field"><TextInput id="proposal-sales-representative" title="Sales Representative" value={salesRepName} onChange={(event) => setSalesRepName(event.target.value)} aria-invalid={showWarnings && Boolean(fieldErrors.salesRepName)} aria-describedby={showWarnings && fieldErrors.salesRepName ? "proposal-sales-representative-error" : undefined} fieldClassName={showWarnings && fieldErrors.salesRepName ? "case-field-error" : ""} /><FieldError id="proposal-sales-representative-error" message={showWarnings ? fieldErrors.salesRepName : undefined} /></div>
        <div className="proposal-editable-field"><DatePicker id="proposal-date" title="Proposal Date" value={proposalDate} onChange={setProposalDate} required ariaInvalid={showWarnings && Boolean(fieldErrors.proposalDate)} ariaDescribedBy={showWarnings && fieldErrors.proposalDate ? "proposal-date-error" : undefined} fieldClassName={showWarnings && fieldErrors.proposalDate ? "case-field-error" : ""} /><FieldError id="proposal-date-error" message={showWarnings ? fieldErrors.proposalDate : undefined} /></div>
        <div className="proposal-editable-field"><TextArea id="proposal-installation-address" title="Installation Address" value={installationAddress} onChange={(event) => setInstallationAddress(event.target.value)} required aria-invalid={showWarnings && Boolean(fieldErrors.installationAddress)} aria-describedby={showWarnings && fieldErrors.installationAddress ? "proposal-installation-address-error" : undefined} fieldClassName={showWarnings && fieldErrors.installationAddress ? "case-field-error" : ""} /><FieldError id="proposal-installation-address-error" message={showWarnings ? fieldErrors.installationAddress : undefined} /></div>
        <div className="proposal-editable-field"><TextInput prefix="RM" id="proposal-sale-amount" title="Sale Amount" inputMode="decimal" value={saleAmount} onChange={(event) => setSaleAmount(event.target.value)} required aria-invalid={showWarnings && Boolean(fieldErrors.saleAmount)} aria-describedby={showWarnings && fieldErrors.saleAmount ? "proposal-sale-amount-error" : undefined} fieldClassName={showWarnings && fieldErrors.saleAmount ? "case-field-error" : ""} /><FieldError id="proposal-sale-amount-error" message={showWarnings ? fieldErrors.saleAmount : undefined} /></div>
        <div className="proposal-editable-field"><TextInput prefix="RM" id="proposal-installation-cost" title="Installation Cost" inputMode="decimal" value={installationCost} onChange={(event) => setInstallationCost(event.target.value)} aria-invalid={showWarnings && Boolean(fieldErrors.installationCost)} aria-describedby={showWarnings && fieldErrors.installationCost ? "proposal-installation-cost-error" : undefined} fieldClassName={showWarnings && fieldErrors.installationCost ? "case-field-error" : ""} /><FieldError id="proposal-installation-cost-error" message={showWarnings ? fieldErrors.installationCost : undefined} /></div>
        <div className="proposal-editable-field"><TextInput prefix="RM" id="proposal-outstation-cost" title="Outstation Cost" inputMode="decimal" value={outstationCost} onChange={(event) => setOutstationCost(event.target.value)} aria-invalid={showWarnings && Boolean(fieldErrors.outstationCost)} aria-describedby={showWarnings && fieldErrors.outstationCost ? "proposal-outstation-cost-error" : undefined} fieldClassName={showWarnings && fieldErrors.outstationCost ? "case-field-error" : ""} /><FieldError id="proposal-outstation-cost-error" message={showWarnings ? fieldErrors.outstationCost : undefined} /></div>
        <div className="proposal-editable-field"><TextArea id="proposal-project-remarks" title="Project Remarks" value={projectRemarks} onChange={(event) => setProjectRemarks(event.target.value)} placeholder="Add project-specific remarks" /></div>
      </div>
      <section className="proposal-readings-section">
        <div className="proposal-section-heading"><div><h3>TNB Readings</h3><p>Start with one completed historical month. Add up to twelve rows; days are fixed from the selected calendar month.</p></div></div>
        {showWarnings && warning && isReadingWarning && <div className="proposal-warning" role="alert">⚠ {warning}</div>}
        <div className="proposal-readings-table">
          <div className="proposal-reading-row proposal-reading-header"><span>Month</span><span>Year</span><span>Bill (RM)</span><span>kWh Used</span><span>TNB Rate</span><span>Days</span><span>Daily kWh</span></div>
          {readings.map((reading, index) => {
            const days = calendarDaysForMonth(reading.month);
            const readingErrors = fieldErrors.readings[index] ?? {};
            const readingHasInput = Boolean(reading.month || reading.year || reading.bill || reading.kwh);
            const availableMonths = monthOptions.filter((option) => option === reading.month || !readings.some((other, otherIndex) => otherIndex !== index && other.month === option));
            const availableMonthNumbers = proposalMonthOptions.filter((month) => availableMonths.some((option) => option.endsWith(`-${month}`)));
            return <div className="proposal-reading-row" key={index}>
              <div className="proposal-reading-field"><FilterSelect id={`proposal-month-${index + 1}`} ariaLabel={`Month ${index + 1}`} allLabel="Select month" value={reading.monthNumber} options={availableMonthNumbers} labels={proposalMonthLabels} onChange={(value) => updateReading(index, "monthNumber", value)} required ariaInvalid={showWarnings && readingHasInput && Boolean(readingErrors.month)} /></div>
              <div className="proposal-reading-field"><TextInput id={`proposal-year-${index + 1}`} aria-label={`Year ${index + 1}`} aria-invalid={showWarnings && readingHasInput && Boolean(readingErrors.month)} placeholder="YYYY" inputMode="numeric" maxLength={4} value={reading.year} onChange={(event) => updateReading(index, "year", event.target.value.replace(/\D/g, "").slice(0, 4))} className={showWarnings && readingHasInput && readingErrors.month ? "proposal-warning-field" : ""} required /></div>
              <div className="proposal-reading-field"><TextInput prefix="RM" aria-label={`Bill amount in RM ${index + 1}`} aria-invalid={showWarnings && readingHasInput && Boolean(readingErrors.bill)} placeholder="1300" inputMode="decimal" className={showWarnings && readingHasInput && readingErrors.bill ? "proposal-warning-field" : ""} value={reading.bill} onChange={(event) => updateReading(index, "bill", event.target.value)} /></div>
              <div className="proposal-reading-field"><TextInput aria-label={`kWh used ${index + 1}`} aria-invalid={showWarnings && readingHasInput && Boolean(readingErrors.kwh)} placeholder="e.g. 2600" inputMode="decimal" className={showWarnings && readingHasInput && readingErrors.kwh ? "proposal-warning-field" : ""} value={reading.kwh} onChange={(event) => updateReading(index, "kwh", event.target.value)} /></div>
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
        {showWarnings && warning && isDownpaymentWarning && <div className="proposal-warning" role="alert">⚠ {warning}</div>}
        {displayPreview && <dl className="proposal-preview-grid"><div><dt>Average Bill</dt><dd>{formatMoney(displayPreview.avgBillSen)}</dd></div><div><dt>Calculated Savings/ Suggested Downpayment</dt><dd>{formatMoney(displayPreview.calculatedDownpaymentSen)}</dd></div><div className={`proposal-preview-downpayment ${showWarnings && fieldErrors.downpayment ? "proposal-preview-downpayment-error" : ""}`}><dt>Downpayment</dt><dd><MoneyInput id="proposal-downpayment" inputMode="decimal" value={downpaymentDisplay} onChange={(event) => setDownpaymentAmount(event.target.value)} required aria-invalid={showWarnings && Boolean(fieldErrors.downpayment)} fieldClassName={showWarnings && fieldErrors.downpayment ? "case-field-error" : ""} /></dd></div><div><dt>Post-Installation</dt><dd>{formatMoney(displayPreview.postInstallationSen)}</dd></div><div><dt>Balance</dt><dd>{formatMoney(displayPreview.balanceSen)}</dd></div><div><dt>10-Month Option</dt><dd>{formatMoney(displayPreview.option1MonthlySen)} / month</dd></div><div><dt>20-Month Option</dt><dd>{formatMoney(displayPreview.option2MonthlySen)} / month</dd></div><div><dt>Annual Saving</dt><dd>{formatMoney(displayPreview.savingRmYearSen)}</dd></div></dl>}
      </section>
      <div className="proposal-form-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="button" variant="secondary" onClick={() => save(false)} loading={busy}>{busy ? "Saving…" : "Save Draft"}</Button><Button type="button" variant="primary" onClick={() => save(true)} loading={busy}>{busy ? "Issuing…" : "Issue Proposal"}</Button></div>
    </div>
  </PopupModal>;
}
