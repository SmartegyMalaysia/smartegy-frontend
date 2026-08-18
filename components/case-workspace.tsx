"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, ConfirmationDialog, Badge } from "./ui";
import { TextInput, TextArea } from "./form-controls";
import { formatDate, formatMoney } from "@/lib/format";
import { casesRepository } from "@/lib/case-repository";
import { canEditCase, caseActionLabels, type CaseActionKind } from "@/lib/case-workflow";
import type { CaseDetail, CurrentUser } from "@/lib/types";

export function CaseWorkspace({ initialCase, user, onChanged }: { initialCase: CaseDetail; user: CurrentUser; onChanged: (value: CaseDetail) => void }) {
  const [caseDetail, setCaseDetail] = useState(initialCase);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dialog, setDialog] = useState<CaseActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [installationDate, setInstallationDate] = useState(new Date().toISOString().slice(0, 10));
  const [depositDue, setDepositDue] = useState(new Date().toISOString().slice(0, 10));
  const [postInstallationDue, setPostInstallationDue] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [savingsKwh, setSavingsKwh] = useState("");
  const [monthlySavings, setMonthlySavings] = useState("");
  const [installmentStart, setInstallmentStart] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [termMonths, setTermMonths] = useState<10 | 20>(10);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [editing, setEditing] = useState(canEditCase(user, initialCase.status, initialCase.agentId));
  const [customerName, setCustomerName] = useState(initialCase.customer.displayName);
  const [contactName, setContactName] = useState(initialCase.customer.contactName ?? "");
  const [email, setEmail] = useState(initialCase.customer.email ?? "");
  const [siteAddress, setSiteAddress] = useState(initialCase.service.siteAddress);
  const actions = caseActionLabels(caseDetail.status, user.role);

  function apply(result: Awaited<ReturnType<typeof casesRepository.getById>>) {
    if (result.ok) { setCaseDetail(result.data); onChanged(result.data); setFeedback("Case updated successfully."); setDialog(null); setReason(""); } else setFeedback(result.error.message);
  }
  async function run(action: CaseActionKind) {
    setBusy(true); setFeedback(null);
    let result: Awaited<ReturnType<typeof casesRepository.getById>>;
    if (action === "request_changes") result = await casesRepository.requestChanges(user, caseDetail.id, reason);
    else if (action === "cancel") result = await casesRepository.cancel(user, caseDetail.id, reason);
    else if (action === "start_review") result = await casesRepository.transition(user, caseDetail.id, user.role === "agent" ? "under_review" : "under_review");
    else if (action === "pass_review") result = await casesRepository.transition(user, caseDetail.id, "quotation_issued");
    else if (action === "issue_quotation") result = await casesRepository.transition(user, caseDetail.id, "awaiting_deposit");
    else if (action === "schedule_installation") result = await casesRepository.transition(user, caseDetail.id, "installation_scheduled");
    else if (action === "move_to_trial") result = await casesRepository.transition(user, caseDetail.id, "trial_review");
    else if (action === "mark_completed") result = await casesRepository.transition(user, caseDetail.id, "completed");
    else if (action === "generate_schedule") result = await casesRepository.generatePaymentSchedule(user, caseDetail.id, { depositDue, postInstallationDue });
    else if (action === "verify_payment") { if (!pendingPayment) { setFeedback("Record a payment before verifying it."); setBusy(false); return; } const schedule = caseDetail.paymentSchedules?.find((item) => item.status !== "paid"); if (!schedule) { setFeedback("There is no unpaid schedule to allocate."); setBusy(false); return; } result = await casesRepository.verifyPayment(user, { paymentId: pendingPayment.id, allocations: [{ scheduleId: schedule.id, amountSen: pendingPayment.amountSen }] }); }
    else if (action === "record_installation") result = await casesRepository.recordInstallation(user, caseDetail.id, installationDate);
    else if (action === "verify_savings") result = await casesRepository.verifySavings(user, caseDetail.id, Number(savingsKwh), Math.round(Number(monthlySavings) * 100));
    else if (action === "accept_trial") result = await casesRepository.acceptTrial(user, caseDetail.id, { installmentStart, termMonths });
    else { setBusy(false); return; }
    apply(result); setBusy(false);
  }
  async function saveDetails() {
    setBusy(true); setFeedback(null); const result = await casesRepository.update(user, caseDetail.id, { customer: { displayName: customerName, contactName, email }, service: { siteAddress } }); apply(result); setBusy(false); setEditing(false);
  }
  async function recordPayment() { setBusy(true); setFeedback(null); const result = await casesRepository.recordPayment(user, caseDetail.id, { amountSen: Math.round(Number(paymentAmount) * 100), paymentDate }); apply(result); setBusy(false); }
  async function openDocument(documentId: string) { const result = await casesRepository.getDocumentUrl(user, caseDetail.id, documentId); if (result.ok) window.open(result.data, "_blank", "noopener,noreferrer"); else setFeedback(result.error.message); }
  const pendingPayment = caseDetail.payments?.find((payment) => payment.status === "pending_verification");

  return <div className="case-workspace">
    <div className="case-action-panel panel"><div className="panel-header"><div><h2>Next actions</h2><p>Actions are checked again by the backend before they are applied.</p></div><Badge status={caseDetail.status} /></div><div className="case-action-list">{actions.map((action) => <Button key={action.kind} type="button" variant={action.variant} disabled={busy} onClick={() => action.requiresReason ? setDialog(action.kind) : run(action.kind)}>{busy ? "Working…" : action.label}</Button>)}</div>{caseDetail.status === "quotation_issued" && <div className="case-action-fields"><label>Deposit due<TextInput type="date" value={depositDue} onChange={(event) => setDepositDue(event.target.value)} /></label><label>Post-installation due<TextInput type="date" value={postInstallationDue} onChange={(event) => setPostInstallationDue(event.target.value)} /></label></div>}{caseDetail.status === "awaiting_deposit" && !pendingPayment && <div className="case-action-fields"><label>Payment amount (RM)<TextInput inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label><label>Payment date<TextInput type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label><Button type="button" variant="secondary" onClick={recordPayment} disabled={busy || !paymentAmount}>Record payment</Button></div>}{caseDetail.status === "installation_scheduled" && <label className="case-action-field">Installation date<TextInput type="date" value={installationDate} onChange={(event) => setInstallationDate(event.target.value)} /></label>}{caseDetail.status === "installed_monitoring" && <div className="case-action-fields"><label>Verified savings (kWh)<TextInput inputMode="decimal" value={savingsKwh} onChange={(event) => setSavingsKwh(event.target.value)} /></label><label>Monthly savings (RM)<TextInput inputMode="decimal" value={monthlySavings} onChange={(event) => setMonthlySavings(event.target.value)} /></label></div>}{caseDetail.status === "trial_review" && <div className="case-action-fields"><label>Installments start<TextInput type="date" value={installmentStart} onChange={(event) => setInstallmentStart(event.target.value)} /></label><label>Term<select value={termMonths} onChange={(event) => setTermMonths(Number(event.target.value) as 10 | 20)}><option value={10}>10 months</option><option value={20}>20 months</option></select></label></div>}{pendingPayment && <p className="case-inline-note">Payment {formatMoney(pendingPayment.amountSen)} is pending verification. Allocate it against the payment schedule before verifying.</p>}{feedback && <p className="case-submit-error" role="status">{feedback}</p>}</div>
    <div className="case-detail-grid"><section className="panel case-form-panel"><div className="panel-header"><div><h2>Customer and service</h2><p>Submitted {formatDate(caseDetail.submittedAt)} by {caseDetail.agentName}</p></div>{canEditCase(user, caseDetail.status, caseDetail.agentId) && <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(!editing)}>{editing ? "Cancel edit" : "Edit details"}</Button>}</div>{editing ? <div className="case-form-body"><label className="case-field">Company name<TextInput value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label><label className="case-field">Contact name<TextInput value={contactName} onChange={(event) => setContactName(event.target.value)} /></label><label className="case-field">Email<TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="case-field">Service address<TextArea value={siteAddress} onChange={(event) => setSiteAddress(event.target.value)} /></label><Button type="button" onClick={saveDetails} disabled={busy}>Save details</Button></div> : <dl className="case-detail-list"><div><dt>Company name</dt><dd>{caseDetail.customer.displayName}</dd></div><div><dt>Registration number</dt><dd>{caseDetail.customer.companyRegistrationNumber ?? "Not provided"}</dd></div><div><dt>Contact</dt><dd>{caseDetail.customer.contactName ?? "Not provided"}</dd></div><div><dt>Email / phone</dt><dd>{[caseDetail.customer.email, caseDetail.customer.phone].filter(Boolean).join(" · ") || "Not provided"}</dd></div><div><dt>Service address</dt><dd>{caseDetail.service.siteAddress || "Not provided"}</dd></div></dl>}</section>
      <section className="panel case-form-panel"><div className="panel-header"><div><h2>Documents</h2><p>Preview or download uses a short-lived secure link.</p></div></div><div className="case-detail-documents">{caseDetail.documents.length ? caseDetail.documents.map((document) => <div className="case-detail-document" key={document.id}><div><strong>{document.fileName}</strong><span>{document.type === "electricity_bill" ? "Latest electricity bill" : "Supporting document"} · {Math.ceil(document.sizeBytes / 1024)} KB</span></div><Button type="button" variant="ghost" size="sm" onClick={() => openDocument(document.id)}>Preview / download</Button></div>) : <p className="detail-empty">No documents uploaded.</p>}</div></section></div>
    <div className="case-detail-grid"><section className="panel case-form-panel"><div className="panel-header"><div><h2>Quote, savings and installation</h2><p>Operational values used by the workflow.</p></div></div><dl className="case-detail-list"><div><dt>Sale amount</dt><dd>{formatMoney(caseDetail.quote?.saleAmountSen ?? caseDetail.saleAmountSen)}</dd></div><div><dt>Quoted monthly savings</dt><dd>{caseDetail.quote?.quotedMonthlySavingsSen == null ? "Not provided" : formatMoney(caseDetail.quote.quotedMonthlySavingsSen)}</dd></div><div><dt>Verified savings</dt><dd>{caseDetail.verifiedSavings?.monthlySavingsSen == null ? "Not verified" : `${formatMoney(caseDetail.verifiedSavings.monthlySavingsSen)} / month`}</dd></div><div><dt>Installation date</dt><dd>{caseDetail.installationDate ?? "Not scheduled"}</dd></div><div><dt>Installment term</dt><dd>{caseDetail.installmentTermMonths ? `${caseDetail.installmentTermMonths} months` : "Not started"}</dd></div></dl></section><section className="panel case-form-panel"><div className="panel-header"><div><h2>Payment schedule</h2><p>Initial obligations and installments</p></div></div><div className="case-schedule-list">{caseDetail.paymentSchedules?.length ? caseDetail.paymentSchedules.map((schedule) => <div className="case-schedule-row" key={schedule.id}><span>{schedule.sequence}. {schedule.kind.replaceAll("_", " ")}<small>{schedule.dueDate}</small></span><span>{formatMoney(schedule.amountPaidSen)} / {formatMoney(schedule.amountDueSen)} <Badge status={schedule.status === "paid" ? "verified" : "pending_verification"} /></span></div>) : <p className="detail-empty">No payment schedule generated.</p>}</div></section></div>
    {caseDetail.commissionIds?.length ? <section className="panel case-form-panel commission-generated"><div className="panel-header"><div><h2>Commission generated</h2><p>Trial acceptance created the commission calculation and entries.</p></div></div><div className="case-commission-links">{caseDetail.commissionIds.map((id) => <Link className="text-link" href={`/commissions/${id}`} key={id}>View commission record {id} <span aria-hidden="true">→</span></Link>)}</div></section> : null}
    <section className="panel case-form-panel"><div className="panel-header"><div><h2>Status timeline</h2><p>Full case audit history</p></div></div><div className="case-detail-activity">{caseDetail.activity.map((event) => <div key={event.id}><span className="case-activity-dot" aria-hidden="true" /><div><strong>{event.summary}</strong><span>{event.actorDisplayName} · {formatDate(event.occurredAt)}</span></div></div>)}</div></section>
    <ConfirmationDialog open={dialog !== null} title={dialog === "cancel" ? "Cancel this case?" : "Request changes?"} description={dialog === "cancel" ? "Cancellation is permanent and unpaid commissions will be withheld." : "The agent will be able to edit and resubmit this case after you provide the correction request."} confirmLabel={dialog === "cancel" ? "Cancel case" : "Request changes"} reason={reason} reasonRequired onReasonChange={setReason} onCancel={() => { setDialog(null); setReason(""); }} onConfirm={() => dialog && run(dialog)} />
  </div>;
}
