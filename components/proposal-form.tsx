"use client";

import { useMemo, useState } from "react";
import { Button } from "./ui";
import { MoneyInput, ReadOnlyField, TextArea, TextInput } from "./form-controls";
import { DatePicker } from "./date-picker";
import { PopupModal } from "./popup-modal";
import { casesRepository } from "@/lib/case-repository";
import { calculateProposalPreview, emptyProposalReadings } from "@/lib/proposal-calculations";
import { formatMoney } from "@/lib/format";
import type { CaseDetail, CurrentUser, ProposalEnergyReading, ProposalInput } from "@/lib/types";

type ReadingDraft = { month: string; rate: string; kwh: string; days: string };
type ReadingWarnings = Record<keyof ReadingDraft, boolean>;
type ProposalWarnings = { salesRepName: boolean; proposalDate: boolean; saleAmount: boolean; readings: ReadingWarnings[] };

function calculateBill(rate: string, kwh: string) {
  const rateValue = Number(rate);
  const kwhValue = Number(kwh);
  if (!rate.trim() || !kwh.trim() || !Number.isFinite(rateValue) || !Number.isFinite(kwhValue)) return "";
  return (rateValue * kwhValue).toFixed(2);
}

function initialReadings(caseDetail: CaseDetail): ReadingDraft[] {
  const hasSavedReadings = Boolean(caseDetail.proposalReadings?.length);
  const readings = hasSavedReadings ? caseDetail.proposalReadings! : emptyProposalReadings();
  return readings.map((reading) => { const rate = reading.tnbRate ? String(reading.tnbRate) : ""; const kwh = reading.kwhUsed ? String(reading.kwhUsed) : ""; return { month: hasSavedReadings ? reading.month : "", rate, kwh, days: hasSavedReadings && reading.operationDays ? String(reading.operationDays) : "" }; });
}

function getProposalWarnings(salesRepName: string, proposalDate: string, saleAmount: string, readings: ReadingDraft[]): ProposalWarnings {
  return {
    salesRepName: !salesRepName.trim(),
    proposalDate: !proposalDate,
    saleAmount: !saleAmount.trim() || !Number.isFinite(Number(saleAmount)) || Number(saleAmount) <= 0,
    readings: readings.map((reading) => ({ month: !reading.month.trim(), rate: !reading.rate.trim() || !Number.isFinite(Number(reading.rate)) || Number(reading.rate) < 0, kwh: !reading.kwh.trim() || !Number.isFinite(Number(reading.kwh)) || Number(reading.kwh) < 0, days: !reading.days.trim() || !Number.isFinite(Number(reading.days)) || Number(reading.days) < 1 || Number(reading.days) > 31 })),
  };
}

function firstProposalWarning(warnings: ProposalWarnings): string | null {
  if (warnings.salesRepName) return "Enter the sales representative name.";
  if (warnings.proposalDate) return "Choose a proposal date.";
  if (warnings.saleAmount) return "Enter a sale amount greater than RM 0.";
  const readingIndex = warnings.readings.findIndex((reading) => Object.values(reading).some(Boolean));
  if (readingIndex < 0) return null;
  const reading = warnings.readings[readingIndex];
  if (reading.month) return `Enter a month for reading ${readingIndex + 1}.`;
  if (reading.rate) return `Enter a valid TNB rate for reading ${readingIndex + 1}.`;
  if (reading.kwh) return `Enter the kWh used for reading ${readingIndex + 1}.`;
  return `Enter a valid number of operation days for reading ${readingIndex + 1}.`;
}

function buildInput(salesRepName: string, proposalDate: string, saleAmount: string, readings: ReadingDraft[]): ProposalInput | null {
  const amount = Number(saleAmount);
  if (!salesRepName.trim() || !proposalDate || !Number.isFinite(amount) || amount <= 0) return null;
  const parsed: ProposalEnergyReading[] = readings.map((reading, index) => ({ sequence: index + 1, month: reading.month.trim(), tnbRate: Number(reading.rate), kwhUsed: Number(reading.kwh), billAmountSen: Math.round(Number(calculateBill(reading.rate, reading.kwh)) * 100), operationDays: Number(reading.days) }));
  if (parsed.some((reading) => !reading.month || !Number.isFinite(reading.tnbRate) || !Number.isFinite(reading.kwhUsed) || !Number.isFinite(reading.billAmountSen) || !Number.isFinite(reading.operationDays))) return null;
  return { salesRepName: salesRepName.trim(), proposalDate, saleAmountSen: Math.round(amount * 100), readings: parsed };
}

export function ProposalForm({ caseDetail, user, onChanged, onClose }: { caseDetail: CaseDetail; user: CurrentUser; onChanged: (value: CaseDetail) => void; onClose: () => void }) {
  const [salesRepName, setSalesRepName] = useState(caseDetail.proposal?.salesRepName ?? user.displayName);
  const [proposalDate, setProposalDate] = useState(caseDetail.proposal?.proposalDate ?? new Date().toISOString().slice(0, 10));
  const [saleAmount, setSaleAmount] = useState(caseDetail.proposal ? String(caseDetail.proposal.saleAmountSen / 100) : caseDetail.saleAmountSen ? String(caseDetail.saleAmountSen / 100) : "");
  const [projectRemarks, setProjectRemarks] = useState(caseDetail.service.notes ?? "");
  const [readings, setReadings] = useState<ReadingDraft[]>(() => initialReadings(caseDetail));
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const input = useMemo(() => buildInput(salesRepName, proposalDate, saleAmount, readings), [salesRepName, proposalDate, saleAmount, readings]);
  const preview = useMemo(() => input ? calculateProposalPreview(input) : null, [input]);
  const fieldWarnings = useMemo(() => getProposalWarnings(salesRepName, proposalDate, saleAmount, readings), [salesRepName, proposalDate, saleAmount, readings]);
  const validationWarning = useMemo(() => firstProposalWarning(fieldWarnings), [fieldWarnings]);

  function updateReading(index: number, key: keyof ReadingDraft, value: string) {
    setReadings((current) => current.map((reading, readingIndex) => readingIndex === index ? { ...reading, [key]: value } : reading));
  }

  async function save(issue: boolean) {
    setShowWarnings(true);
    if (validationWarning) { setWarning(validationWarning); return; }
    if (!input) { setWarning("Complete the sales representative, sale amount, date, and all twelve readings."); return; }
    if (!preview) { setWarning("The initial payment obligation cannot exceed the sale amount."); return; }
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

  return <PopupModal open title="Prepare Proposal" description="Review the customer details, twelve months of TNB readings, and server-calculated payment values before issuing the proposal." size="lg" className="proposal-dialog" onClose={onClose} hasUnsavedChanges={!busy} closeOnBackdrop={false}>
    <div className="proposal-form">
      <div className="proposal-form-grid">
        <ReadOnlyField id="proposal-customer" title="Customer" value={caseDetail.customer.displayName} />
        <ReadOnlyField id="proposal-service-address" title="Service Address" value={caseDetail.service.siteAddress || "Not provided"} multiline />
        <ReadOnlyField id="proposal-contact-person" title="Contact Person" value={caseDetail.customer.contactName ?? "Not provided"} />
        <ReadOnlyField id="proposal-customer-email" title="Contact Email" value={caseDetail.customer.email ?? "Not provided"} />
        <TextInput title="Sales Representative" value={salesRepName} onChange={(event) => setSalesRepName(event.target.value)} required fieldClassName={showWarnings && fieldWarnings.salesRepName ? "case-field-warning" : ""} />
        <DatePicker id="proposal-date" title="Proposal Date" value={proposalDate} onChange={setProposalDate} required fieldClassName={showWarnings && fieldWarnings.proposalDate ? "case-field-warning" : ""} />
        <MoneyInput id="proposal-sale-amount" title="Sale Amount" inputMode="decimal" value={saleAmount} onChange={(event) => setSaleAmount(event.target.value)} required fieldClassName={showWarnings && (fieldWarnings.saleAmount || (Boolean(input) && !preview)) ? "case-field-warning" : ""} />
        <TextArea title="Project Remarks" value={projectRemarks} onChange={(event) => setProjectRemarks(event.target.value)} placeholder="Add project-specific remarks" />
      </div>
      <section className="proposal-readings-section">
        <div className="proposal-section-heading"><div><h3>TNB Readings</h3><p>Enter all twelve months. Daily kWh is calculated from kWh used and operation days.</p></div></div>
        <div className="proposal-readings-table">
          <div className="proposal-reading-row proposal-reading-header"><span>#</span><span>Month</span><span>Rate</span><span>kWh Used</span><span>Bill (RM)</span><span>Days</span><span>Daily kWh</span></div>
          {readings.map((reading, index) => { const dailyKwh = Number.isFinite(Number(reading.kwh)) && Number(reading.days) > 0 ? (Number(reading.kwh) / Number(reading.days)).toFixed(3) : "—"; const calculatedBill = calculateBill(reading.rate, reading.kwh); const readingWarnings = fieldWarnings.readings[index]; return <div className="proposal-reading-row" key={index}><span>{index + 1}</span><TextInput aria-label={`Month ${index + 1}`} placeholder={`Month ${index + 1}`} className={showWarnings && readingWarnings.month ? "proposal-warning-field" : ""} value={reading.month} onChange={(event) => updateReading(index, "month", event.target.value)} /><TextInput aria-label={`Rate ${index + 1}`} placeholder="e.g. 0.30" inputMode="decimal" className={showWarnings && readingWarnings.rate ? "proposal-warning-field" : ""} value={reading.rate} onChange={(event) => updateReading(index, "rate", event.target.value)} /><TextInput aria-label={`kWh used ${index + 1}`} placeholder="e.g. 1250" inputMode="decimal" className={showWarnings && readingWarnings.kwh ? "proposal-warning-field" : ""} value={reading.kwh} onChange={(event) => updateReading(index, "kwh", event.target.value)} /><span className="proposal-reading-calculated" aria-label={`Calculated bill amount ${index + 1}`}>{calculatedBill ? `RM ${calculatedBill}` : "—"}</span><TextInput aria-label={`Operation days ${index + 1}`} placeholder="e.g. 30" inputMode="numeric" className={showWarnings && readingWarnings.days ? "proposal-warning-field" : ""} value={reading.days} onChange={(event) => updateReading(index, "days", event.target.value)} /><span className="proposal-reading-calculated" aria-label={`Daily kWh ${index + 1}`}>{dailyKwh}</span></div>; })}
        </div>
      </section>
      <section className="proposal-preview-section">
        <div className="proposal-section-heading"><div><h3>Calculated Preview</h3><p>Final values are recalculated and validated by the system.</p></div></div>
        {preview ? <dl className="proposal-preview-grid"><div><dt>Average Bill</dt><dd>{formatMoney(preview.avgBillSen)}</dd></div><div><dt>Monthly Saving</dt><dd>{formatMoney(preview.savingRmMonthSen)}</dd></div><div><dt>Deposit</dt><dd>{formatMoney(preview.deposit1Sen)}</dd></div><div><dt>Post-Installation</dt><dd>{formatMoney(preview.deposit2Sen)}</dd></div><div><dt>Balance</dt><dd>{formatMoney(preview.balanceSen)}</dd></div><div><dt>10-Month Option</dt><dd>{formatMoney(preview.option1MonthlySen)} / month</dd></div><div><dt>20-Month Option</dt><dd>{formatMoney(preview.option2MonthlySen)} / month</dd></div><div><dt>Annual Saving</dt><dd>{formatMoney(preview.savingRmYearSen)}</dd></div></dl> : <p className="detail-empty">Complete the required values to see the calculation preview.</p>}
      </section>
      {warning && <p className="proposal-warning" role="alert">⚠ {warning}</p>}
      <div className="proposal-form-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="button" variant="secondary" onClick={() => save(false)} disabled={busy}>{busy ? "Saving…" : "Save Draft"}</Button><Button type="button" variant="primary" onClick={() => save(true)} disabled={busy}>{busy ? "Issuing…" : "Issue Proposal"}</Button></div>
    </div>
  </PopupModal>;
}
