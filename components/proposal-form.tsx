"use client";

import { useMemo, useState } from "react";
import { Button } from "./ui";
import { MoneyInput, TextArea, TextInput } from "./form-controls";
import { DatePicker } from "./date-picker";
import { PopupModal } from "./popup-modal";
import { casesRepository } from "@/lib/case-repository";
import { calculateProposalPreview, emptyProposalReadings } from "@/lib/proposal-calculations";
import { formatMoney } from "@/lib/format";
import type { CaseDetail, CurrentUser, ProposalEnergyReading, ProposalInput } from "@/lib/types";

type ReadingDraft = { month: string; rate: string; kwh: string; bill: string; days: string };

function initialReadings(caseDetail: CaseDetail): ReadingDraft[] {
  const readings = caseDetail.proposalReadings?.length ? caseDetail.proposalReadings : emptyProposalReadings();
  return readings.map((reading) => ({ month: reading.month, rate: reading.tnbRate ? String(reading.tnbRate) : "", kwh: reading.kwhUsed ? String(reading.kwhUsed) : "", bill: reading.billAmountSen ? String(reading.billAmountSen / 100) : "", days: reading.operationDays ? String(reading.operationDays) : "30" }));
}

function buildInput(salesRepName: string, proposalDate: string, saleAmount: string, readings: ReadingDraft[]): ProposalInput | null {
  const amount = Number(saleAmount);
  if (!salesRepName.trim() || !proposalDate || !Number.isFinite(amount) || amount <= 0) return null;
  const parsed: ProposalEnergyReading[] = readings.map((reading, index) => ({ sequence: index + 1, month: reading.month.trim(), tnbRate: Number(reading.rate), kwhUsed: Number(reading.kwh), billAmountSen: Math.round(Number(reading.bill) * 100), operationDays: Number(reading.days) }));
  if (parsed.some((reading) => !reading.month || !Number.isFinite(reading.tnbRate) || !Number.isFinite(reading.kwhUsed) || !Number.isFinite(reading.billAmountSen) || !Number.isFinite(reading.operationDays))) return null;
  return { salesRepName: salesRepName.trim(), proposalDate, saleAmountSen: Math.round(amount * 100), readings: parsed };
}

export function ProposalForm({ caseDetail, user, onChanged, onClose }: { caseDetail: CaseDetail; user: CurrentUser; onChanged: (value: CaseDetail) => void; onClose: () => void }) {
  const [salesRepName, setSalesRepName] = useState(caseDetail.proposal?.salesRepName ?? user.displayName);
  const [proposalDate, setProposalDate] = useState(caseDetail.proposal?.proposalDate ?? new Date().toISOString().slice(0, 10));
  const [saleAmount, setSaleAmount] = useState(caseDetail.proposal ? String(caseDetail.proposal.saleAmountSen / 100) : caseDetail.saleAmountSen ? String(caseDetail.saleAmountSen / 100) : "");
  const [readings, setReadings] = useState<ReadingDraft[]>(() => initialReadings(caseDetail));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useMemo(() => buildInput(salesRepName, proposalDate, saleAmount, readings), [salesRepName, proposalDate, saleAmount, readings]);
  const preview = useMemo(() => input ? calculateProposalPreview(input) : null, [input]);

  function updateReading(index: number, key: keyof ReadingDraft, value: string) {
    setReadings((current) => current.map((reading, readingIndex) => readingIndex === index ? { ...reading, [key]: value } : reading));
  }

  async function save(issue: boolean) {
    if (!input) { setError("Complete the sales representative, sale amount, date, and all twelve readings."); return; }
    if (!preview) { setError("The initial payment obligation cannot exceed the sale amount."); return; }
    setBusy(true); setError(null);
    const result = issue ? await casesRepository.issueProposal(user, caseDetail.id, input) : await casesRepository.saveProposalDraft(user, caseDetail.id, input);
    if (result.ok) { onChanged(result.data); if (issue) onClose(); else setError(null); }
    else setError(result.error.message);
    setBusy(false);
  }

  return <PopupModal open title="Prepare Proposal" description="Review the customer details, twelve months of TNB readings, and server-calculated payment values before issuing the proposal." size="lg" className="proposal-dialog" onClose={onClose} hasUnsavedChanges={!busy} closeOnBackdrop={false}>
    <div className="proposal-form">
      <div className="proposal-form-grid">
        <TextInput title="Customer" value={caseDetail.customer.displayName} readOnly />
        <TextInput title="Contact Person" value={caseDetail.customer.contactName ?? "Not provided"} readOnly />
        <TextArea title="Service Address" value={caseDetail.service.siteAddress || "Not provided"} readOnly />
        <TextInput title="Electricity Account" value={caseDetail.service.electricityAccountNumber ?? "Not provided"} readOnly />
        <TextInput title="Sales Representative" value={salesRepName} onChange={(event) => setSalesRepName(event.target.value)} required />
        <DatePicker id="proposal-date" title="Proposal Date" value={proposalDate} onChange={setProposalDate} required />
        <MoneyInput id="proposal-sale-amount" title="Sale Amount" inputMode="decimal" value={saleAmount} onChange={(event) => setSaleAmount(event.target.value)} required />
        <TextInput title="Customer Email" value={caseDetail.customer.email ?? "Not provided"} readOnly />
        <TextArea title="Project Remarks" value={caseDetail.service.notes ?? "No remarks provided"} readOnly />
      </div>
      <section className="proposal-readings-section">
        <div className="proposal-section-heading"><div><h3>TNB Readings</h3><p>Enter all twelve months. Daily kWh is calculated from kWh used and operation days.</p></div></div>
        <div className="proposal-readings-table">
          <div className="proposal-reading-row proposal-reading-header"><span>#</span><span>Month</span><span>Rate</span><span>kWh Used</span><span>Bill (RM)</span><span>Days</span><span>Daily kWh</span></div>
          {readings.map((reading, index) => { const dailyKwh = Number.isFinite(Number(reading.kwh)) && Number(reading.days) > 0 ? (Number(reading.kwh) / Number(reading.days)).toFixed(3) : "—"; return <div className="proposal-reading-row" key={index}><span>{index + 1}</span><TextInput aria-label={`Month ${index + 1}`} value={reading.month} onChange={(event) => updateReading(index, "month", event.target.value)} /><TextInput aria-label={`Rate ${index + 1}`} inputMode="decimal" value={reading.rate} onChange={(event) => updateReading(index, "rate", event.target.value)} /><TextInput aria-label={`kWh used ${index + 1}`} inputMode="decimal" value={reading.kwh} onChange={(event) => updateReading(index, "kwh", event.target.value)} /><TextInput aria-label={`Bill amount ${index + 1}`} inputMode="decimal" value={reading.bill} onChange={(event) => updateReading(index, "bill", event.target.value)} /><TextInput aria-label={`Operation days ${index + 1}`} inputMode="numeric" value={reading.days} onChange={(event) => updateReading(index, "days", event.target.value)} /><span className="proposal-reading-calculated" aria-label={`Daily kWh ${index + 1}`}>{dailyKwh}</span></div>; })}
        </div>
      </section>
      <section className="proposal-preview-section">
        <div className="proposal-section-heading"><div><h3>Calculated Preview</h3><p>Final values are recalculated and validated by the backend.</p></div></div>
        {preview ? <dl className="proposal-preview-grid"><div><dt>Average Bill</dt><dd>{formatMoney(preview.avgBillSen)}</dd></div><div><dt>Monthly Saving</dt><dd>{formatMoney(preview.savingRmMonthSen)}</dd></div><div><dt>Deposit</dt><dd>{formatMoney(preview.deposit1Sen)}</dd></div><div><dt>Post-Installation</dt><dd>{formatMoney(preview.deposit2Sen)}</dd></div><div><dt>Balance</dt><dd>{formatMoney(preview.balanceSen)}</dd></div><div><dt>10-Month Option</dt><dd>{formatMoney(preview.option1MonthlySen)} / month</dd></div><div><dt>20-Month Option</dt><dd>{formatMoney(preview.option2MonthlySen)} / month</dd></div><div><dt>Annual Saving</dt><dd>{formatMoney(preview.savingRmYearSen)}</dd></div></dl> : <p className="detail-empty">Complete the required values to see the calculation preview.</p>}
      </section>
      {error && <p className="case-field-error-message" role="alert">{error}</p>}
      <div className="proposal-form-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="button" variant="secondary" onClick={() => save(false)} disabled={busy}>{busy ? "Saving…" : "Save Draft"}</Button><Button type="button" variant="primary" onClick={() => save(true)} disabled={busy}>{busy ? "Issuing…" : "Issue Proposal"}</Button></div>
    </div>
  </PopupModal>;
}
