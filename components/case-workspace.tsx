"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ConfirmationDialog, Badge } from "./ui";
import { MoneyInput, ReadOnlyField, TextInput, TextArea } from "./form-controls";
import { DatePicker } from "./date-picker";
import { FilterSelect } from "./filter-select";
import { Toast, type ToastTone } from "./toast";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { casesRepository } from "@/lib/case-repository";
import { canEditCase, caseActionLabels, type CaseActionKind } from "@/lib/case-workflow";
import type { CaseDetail, CurrentUser } from "@/lib/types";

type CaseToast = { title: string; subtitle: string; tone: ToastTone };

function moneyInputValue(value: number | null | undefined) { return value == null ? "" : String(value / 100); }

export function CaseWorkspace({ initialCase, user, onChanged, onDeleted }: { initialCase: CaseDetail; user: CurrentUser; onChanged: (value: CaseDetail) => void; onDeleted: () => void }) {
  const [caseDetail, setCaseDetail] = useState(initialCase);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<CaseToast | null>(null);
  const [dialog, setDialog] = useState<CaseActionKind | null>(null);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [installationDate, setInstallationDate] = useState(new Date().toISOString().slice(0, 10));
  const [depositDue, setDepositDue] = useState(new Date().toISOString().slice(0, 10));
  const [postInstallationDue, setPostInstallationDue] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [savingsKwh, setSavingsKwh] = useState("");
  const [monthlySavings, setMonthlySavings] = useState("");
  const [savingsError, setSavingsError] = useState<string | null>(null);
  const [installmentStart, setInstallmentStart] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [termMonths, setTermMonths] = useState<10 | 20>(10);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [installationPaymentAmount, setInstallationPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentReference, setPaymentReference] = useState("");
  const [installationProposalDate, setInstallationProposalDate] = useState(new Date().toISOString().slice(0, 10));
  const canEditDetails = user.role !== "agent" && canEditCase(user, initialCase.status, initialCase.agentId);
  const [editing, setEditing] = useState(false);
  const [customerName, setCustomerName] = useState(initialCase.customer.displayName);
  const [contactName, setContactName] = useState(initialCase.customer.contactName ?? "");
  const [email, setEmail] = useState(initialCase.customer.email ?? "");
  const [phone, setPhone] = useState(initialCase.customer.phone ?? "");
  const [siteAddress, setSiteAddress] = useState(initialCase.service.siteAddress);
  const [remarks, setRemarks] = useState(initialCase.service.notes ?? "");
  const [saleAmount, setSaleAmount] = useState(moneyInputValue(initialCase.quote?.saleAmountSen ?? initialCase.saleAmountSen));
  const [quotedMonthlySavings, setQuotedMonthlySavings] = useState(moneyInputValue(initialCase.quote?.quotedMonthlySavingsSen));
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const depositPaid = Boolean(caseDetail.paymentSchedules?.some((schedule) => schedule.kind === "deposit" && schedule.amountPaidSen >= schedule.amountDueSen));
  const pendingPayment = caseDetail.payments?.find((payment) => payment.status === "pending_verification");
  const depositPending = Boolean(pendingPayment && !depositPaid);
  const actions = caseActionLabels(caseDetail.status, user.role, Boolean(caseDetail.paymentSchedules?.length), depositPaid, depositPending);
  const latestStaffRemark = [...caseDetail.activity].reverse().find((event) => event.reason?.trim())?.reason ?? null;
  const depositSchedule = (caseDetail.paymentSchedules ?? []).find((schedule) => schedule.kind === "deposit" && schedule.amountDueSen > schedule.amountPaidSen);
  const postInstallationSchedule = (caseDetail.paymentSchedules ?? []).find((schedule) => schedule.kind === "post_installation");
  const allocatableSchedules = (caseDetail.paymentSchedules ?? []).filter((schedule) => schedule.amountDueSen > schedule.amountPaidSen);

  useEffect(() => { setDialog(null); setRecordPaymentOpen(false); setEditing(false); setReason(""); setQuoteError(null); setPaymentError(null); setAllocationError(null); setSavingsError(null); setResubmitError(null); }, [initialCase.id]);

  function showError(message: string, title = "Action Failed") { setToast({ title, subtitle: message, tone: "error" }); }
  function syncQuoteFields(value: CaseDetail) {
    setSaleAmount(moneyInputValue(value.quote?.saleAmountSen ?? value.saleAmountSen));
    setQuotedMonthlySavings(moneyInputValue(value.quote?.quotedMonthlySavingsSen));
  }
  function setCaseData(value: CaseDetail) { setCaseDetail(value); onChanged(value); syncQuoteFields(value); }
  function getQuoteInput() {
    const sale = Number(saleAmount);
    const savings = Number(quotedMonthlySavings);
    const message = "Sale amount and quoted monthly savings are required before quotation.";
    if (!saleAmount.trim() || !quotedMonthlySavings.trim() || !Number.isFinite(sale) || sale <= 0 || !Number.isFinite(savings) || savings <= 0) {
      setQuoteError(message);
      return false;
    }
    setQuoteError(null);
    return { saleAmountSen: Math.round(sale * 100), quotedMonthlySavingsSen: Math.round(savings * 100) };
  }
  function getScheduleDates() {
    if (!depositDue || !postInstallationDue) {
      setQuoteError("Deposit due and post-installation due dates are required.");
      return false;
    }
    return { depositDue, postInstallationDue };
  }
  const depositBalanceSen = depositSchedule ? depositSchedule.amountDueSen - depositSchedule.amountPaidSen : 0;
  const postInstallationBalanceSen = postInstallationSchedule ? Math.max(0, postInstallationSchedule.amountDueSen - postInstallationSchedule.amountPaidSen) : 0;
  function openDialog(action: CaseActionKind) {
    if (action === "pass_review") setQuoteError(null);
    if (action === "submit_deposit") { openRecordPayment(); return; }
    if (action === "verify_deposit") { setPaymentError(null); setReason(""); }
    if (action === "propose_installation_date") { setPaymentError(null); setInstallationProposalDate(caseDetail.installationProposedDate ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)); }
    if (action === "confirm_installation_date" || action === "request_installation_date_change") setReason("");
    if (action === "record_installation") { setPaymentError(null); setInstallationPaymentAmount(moneyInputValue(postInstallationBalanceSen)); setInstallationDate(caseDetail.installationDate ?? new Date().toISOString().slice(0, 10)); }
    if (action === "verify_savings") setSavingsError(null);
    if (action === "resubmit") setResubmitError(null);
    setDialog(action);
  }
  function closeDialog() { setDialog(null); setRecordPaymentOpen(false); setReason(""); setQuoteError(null); setPaymentError(null); setAllocationError(null); setSavingsError(null); setResubmitError(null); }
  function openRecordPayment() { setDialog(null); setPaymentError(null); setPaymentAmount(moneyInputValue(depositBalanceSen)); setPaymentDate(new Date().toISOString().slice(0, 10)); setPaymentReference(""); setRecordPaymentOpen(true); }
  function closeRecordPayment() { setRecordPaymentOpen(false); setDialog(null); setPaymentError(null); }
  function apply(result: Awaited<ReturnType<typeof casesRepository.getById>>) {
    if (result.ok) { setCaseData(result.data); setToast({ title: "Case Updated", subtitle: "The case changes were saved successfully.", tone: "success" }); closeDialog(); }
    else showError(result.error.message);
  }
  function getResubmitInput() {
    if (!customerName.trim() || !siteAddress.trim()) {
      setResubmitError("Company name and service address are required.");
      return false;
    }
    setResubmitError(null);
    return { customer: { displayName: customerName, contactName, email, phone }, service: { siteAddress, notes: remarks } };
  }
  async function run(action: CaseActionKind) {
    setBusy(true);
    setToast(null);
    if (action === "delete_case") {
      const deleted = await casesRepository.deleteCase(user, caseDetail.id);
      if (deleted.ok) onDeleted();
      else showError(deleted.error.message);
      setBusy(false);
      return;
    }
    let result: Awaited<ReturnType<typeof casesRepository.getById>>;
    if (action === "pass_review") {
      const quote = getQuoteInput();
      if (quote === false) { setBusy(false); return; }
      const scheduleDates = getScheduleDates();
      if (scheduleDates === false) { setBusy(false); return; }
      const saved = await casesRepository.update(user, caseDetail.id, { quote });
      if (!saved.ok) { apply(saved); setBusy(false); return; }
      setCaseData(saved.data);
      const transitioned = await casesRepository.transition(user, caseDetail.id, "quotation_issued");
      if (!transitioned.ok) { result = transitioned; }
      else {
        const generated = await casesRepository.generatePaymentSchedule(user, caseDetail.id, scheduleDates);
        result = generated.ok ? await casesRepository.transition(user, caseDetail.id, "awaiting_deposit") : generated;
      }
    } else if (action === "request_changes") result = await casesRepository.requestChanges(user, caseDetail.id, reason);
    else if (action === "cancel") result = await casesRepository.cancel(user, caseDetail.id, reason);
    else if (action === "resubmit") {
      const details = getResubmitInput();
      if (details === false) { setBusy(false); return; }
      const saved = await casesRepository.update(user, caseDetail.id, details);
      if (!saved.ok) { apply(saved); setBusy(false); return; }
      setCaseData(saved.data);
      result = await casesRepository.transition(user, caseDetail.id, "under_review");
    }
    else if (action === "move_to_trial") result = await casesRepository.transition(user, caseDetail.id, "trial_review");
    else if (action === "generate_schedule") {
      const generated = await casesRepository.generatePaymentSchedule(user, caseDetail.id, { depositDue, postInstallationDue });
      result = generated.ok ? await casesRepository.transition(user, caseDetail.id, "awaiting_deposit") : generated;
    }
    else if (action === "submit_deposit") {
      const amount = Number(paymentAmount);
      if (!paymentAmount.trim() || !Number.isFinite(amount) || amount <= 0 || !paymentDate) { setPaymentError("Deposit amount and payment date are required."); setBusy(false); return; }
      result = await casesRepository.submitDeposit(user, caseDetail.id, { amountSen: Math.round(amount * 100), paymentDate, reference: paymentReference.trim() || null });
    } else if (action === "verify_deposit") {
      if (!pendingPayment || !depositSchedule) { result = { ok: false, error: { code: "VALIDATION_ERROR", message: "No pending deposit is available for review." } }; }
      else result = await casesRepository.verifyPayment(user, { paymentId: pendingPayment.id, allocations: [{ scheduleId: depositSchedule.id, amountSen: pendingPayment.amountSen }] });
    } else if (action === "propose_installation_date") {
      if (!installationProposalDate) { setPaymentError("An installation date is required."); setBusy(false); return; }
      result = await casesRepository.proposeInstallationDate(user, caseDetail.id, installationProposalDate);
    } else if (action === "confirm_installation_date") {
      result = await casesRepository.respondToInstallationDate(user, caseDetail.id, true);
    } else if (action === "request_installation_date_change") {
      if (!reason.trim()) { result = { ok: false, error: { code: "VALIDATION_ERROR", message: "Tell staff why a different installation date is needed." } }; }
      else result = await casesRepository.respondToInstallationDate(user, caseDetail.id, false, reason);
    } else if (action === "verify_payment") {
      const amount = Number(paymentAmount);
      if (!paymentAmount.trim() || !Number.isFinite(amount) || amount <= 0 || !paymentDate) { setPaymentError("Payment amount and payment date are required."); setBusy(false); return; }
      result = await casesRepository.recordAndVerifyPayment(user, caseDetail.id, { amountSen: Math.round(amount * 100), paymentDate });
    } else if (action === "record_installation") {
      const amount = Number(installationPaymentAmount);
      if (postInstallationBalanceSen > 0 && (!installationPaymentAmount.trim() || !Number.isFinite(amount) || amount <= 0 || !installationDate)) {
        setPaymentError("Payment amount and installation date are required.");
        setBusy(false);
        return;
      }
      const completeInstallation = async () => casesRepository.recordInstallation(user, caseDetail.id, installationDate);
      if (postInstallationBalanceSen > 0) {
        const payment = await casesRepository.recordAndVerifyPayment(user, caseDetail.id, { amountSen: Math.round(amount * 100), paymentDate: installationDate });
        result = payment.ok ? await completeInstallation() : payment;
      } else {
        result = await completeInstallation();
      }
    }
    else if (action === "verify_savings") {
      const savings = Number(savingsKwh);
      const monthly = Number(monthlySavings);
      if (!savingsKwh.trim() || !Number.isFinite(savings) || savings < 0 || !monthlySavings.trim() || !Number.isFinite(monthly) || monthly < 0) { setSavingsError("Verified savings and monthly savings are required."); setBusy(false); return; }
      const verified = await casesRepository.verifySavings(user, caseDetail.id, savings, Math.round(monthly * 100));
      result = verified.ok ? await casesRepository.transition(user, caseDetail.id, "trial_review") : verified;
    }
    else if (action === "accept_trial") result = await casesRepository.acceptTrial(user, caseDetail.id, { installmentStart, termMonths });
    else { setBusy(false); return; }
    apply(result);
    setBusy(false);
  }
  async function saveDetails() {
    setBusy(true);
    setToast(null);
    const result = await casesRepository.update(user, caseDetail.id, { customer: { displayName: customerName, contactName, email, phone }, service: { siteAddress, notes: remarks } });
    apply(result);
    setBusy(false);
    if (result.ok) setEditing(false);
  }
  async function recordPayment() {
    const amount = Number(paymentAmount);
    if (!paymentAmount.trim() || !Number.isFinite(amount) || amount <= 0 || !paymentDate) { setPaymentError("Payment amount and payment date are required."); return; }
    setBusy(true);
    setToast(null);
    const result = await casesRepository.submitDeposit(user, caseDetail.id, { amountSen: Math.round(amount * 100), paymentDate, reference: paymentReference.trim() || null });
    if (result.ok) closeRecordPayment();
    apply(result);
    setBusy(false);
  }
  async function rejectDeposit() {
    if (!pendingPayment || !reason.trim()) { setPaymentError("A rejection reason is required."); return; }
    setBusy(true);
    setToast(null);
    const result = await casesRepository.rejectPayment(user, { paymentId: pendingPayment.id, reason: reason.trim() });
    apply(result);
    setBusy(false);
  }
  async function openDocument(documentId: string) { const result = await casesRepository.getDocumentUrl(user, caseDetail.id, documentId); if (result.ok) window.open(result.data, "_blank", "noopener,noreferrer"); else showError(result.error.message, "Document Access Failed"); }

  return <div className="case-workspace">
    <div className="case-action-panel panel">
      <div className="panel-header"><div><h2>Next Actions</h2><p>Actions are checked again by the backend before they are applied.</p></div></div>
      {caseDetail.status === "quotation_issued" && !caseDetail.paymentSchedules?.length && <div className="case-action-fields"><DatePicker id="deposit-due" title="Deposit Due" value={depositDue} placeholder="DD/MM/YYYY" onChange={setDepositDue} /><DatePicker id="post-installation-due" title="Post-Installation Due" value={postInstallationDue} placeholder="DD/MM/YYYY" onChange={setPostInstallationDue} /></div>}
      {user.role === "agent" && pendingPayment && <p className="case-action-note">Deposit submitted on {pendingPayment.paymentDate}; staff verification is pending.</p>}
      {caseDetail.status === "installation_date_proposed" && caseDetail.installationProposedDate && <p className="case-action-note">Proposed installation date: <strong>{caseDetail.installationProposedDate}</strong>{caseDetail.installationDateFeedback ? " — Staff needs a response to your date-change request." : " — Please confirm this date."}</p>}
      {user.role !== "agent" && caseDetail.status === "awaiting_deposit" && !depositPending && !depositPaid && <p className="case-action-note">Waiting for the agent to submit the deposit.</p>}
      
      
      <div className="case-action-list">{actions.map((action) => <Button key={action.kind} type="button" variant={action.variant} disabled={busy} onClick={() => action.requiresReason || action.kind === "pass_review" || action.kind === "submit_deposit" || action.kind === "verify_deposit" || action.kind === "propose_installation_date" || action.kind === "confirm_installation_date" || action.kind === "record_installation" || action.kind === "verify_savings" || action.kind === "accept_trial" || action.kind === "delete_case" || action.kind === "resubmit" ? openDialog(action.kind) : run(action.kind)}>{busy ? "Working…" : action.label}</Button>)}</div>
    </div>
    <div className="case-detail-grid">
      <section className="panel case-form-panel"><div className="panel-header"><div><h2>Customer and Service</h2><p>Submitted {formatDate(caseDetail.submittedAt)} by {caseDetail.agentName}</p></div>{canEditDetails && <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(!editing)}>{editing ? "Cancel Edit" : "Edit Details"}</Button>}</div>{editing ? <div className="case-form-body"><TextInput title="Company Name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /><TextInput title="Contact Name" value={contactName} onChange={(event) => setContactName(event.target.value)} /><TextInput title="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /><TextInput title="Phone Number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /><TextArea title="Service Address" value={siteAddress} onChange={(event) => setSiteAddress(event.target.value)} /><TextArea title="Remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} /><Button type="button" onClick={saveDetails} disabled={busy}>Save Details</Button></div> : <dl className="case-detail-list"><div><dt>Company Name</dt><dd>{caseDetail.customer.displayName}</dd></div><div><dt>Contact</dt><dd>{caseDetail.customer.contactName ?? "Not provided"}</dd></div><div><dt>Email</dt><dd>{caseDetail.customer.email ?? "Not provided"}</dd></div><div><dt>Phone</dt><dd>{caseDetail.customer.phone ?? "Not provided"}</dd></div><div><dt>Service Address</dt><dd>{caseDetail.service.siteAddress || "Not provided"}</dd></div><div><dt>Remarks</dt><dd>{caseDetail.service.notes || "No remarks provided."}</dd></div></dl>}</section>
      <section className="panel case-form-panel"><div className="panel-header"><div><h2>Documents</h2><p>Preview or download uses a short-lived secure link.</p></div></div><div className="case-detail-documents">{caseDetail.documents.length ? caseDetail.documents.map((document) => <div className="case-detail-document" key={document.id}><div><strong>{document.fileName}</strong><span>{document.type === "electricity_bill" ? "Latest electricity bill" : "Supporting document"} · {Math.ceil(document.sizeBytes / 1024)} KB</span></div><Button type="button" variant="ghost" size="sm" onClick={() => openDocument(document.id)}>Preview / Download</Button></div>) : <p className="detail-empty">No documents uploaded.</p>}</div></section>
    </div>
    <div className="case-detail-grid"><section className="panel case-form-panel"><div className="panel-header"><div><h2>Quote, Savings and Installation</h2><p>Operational values used by the workflow.</p></div></div><dl className="case-detail-list"><div><dt>Sale amount</dt><dd>{formatMoney(caseDetail.quote?.saleAmountSen ?? caseDetail.saleAmountSen)}</dd></div><div><dt>Quoted monthly savings</dt><dd>{caseDetail.quote?.quotedMonthlySavingsSen == null ? "Not provided" : formatMoney(caseDetail.quote.quotedMonthlySavingsSen)}</dd></div><div><dt>Verified savings</dt><dd>{caseDetail.verifiedSavings?.monthlySavingsSen == null ? "Not verified" : `${formatMoney(caseDetail.verifiedSavings.monthlySavingsSen)} / month`}</dd></div><div><dt>Installation date</dt><dd>{caseDetail.installationDate ?? "Not scheduled"}</dd></div><div><dt>Installment term</dt><dd>{caseDetail.installmentTermMonths ? `${caseDetail.installmentTermMonths} months` : "Not started"}</dd></div></dl></section><section className="panel case-form-panel"><div className="panel-header"><div><h2>Payment Schedule</h2><p>Initial obligations and installments</p></div></div><div className="case-schedule-list">{caseDetail.paymentSchedules?.length ? caseDetail.paymentSchedules.map((schedule) => <div className="case-schedule-row" key={schedule.id}><span>{schedule.sequence}. {titleCase(schedule.kind)}<small>{schedule.dueDate}</small></span><span>{formatMoney(schedule.amountPaidSen)} / {formatMoney(schedule.amountDueSen)} <Badge status={schedule.status === "paid" ? "verified" : "pending_verification"} /></span></div>) : <p className="detail-empty">No payment schedule generated.</p>}</div></section></div>
    {caseDetail.commissionIds?.length ? <section className="panel case-form-panel commission-generated"><div className="panel-header"><div><h2>Commission Generated</h2><p>Trial acceptance created the commission calculation and entries.</p></div></div><div className="case-commission-links">{caseDetail.commissionIds.map((id) => <Link className="text-link" href={`/commissions/${id}`} key={id}>View commission record {id} <span aria-hidden="true">→</span></Link>)}</div></section> : null}
    <section className="panel case-form-panel"><div className="panel-header"><div><h2>Status Timeline</h2><p>Full case audit history</p></div></div><div className="case-detail-activity">{caseDetail.activity.map((event) => <div key={event.id}><span className="case-activity-dot" aria-hidden="true" /><div className="case-activity-content"><strong>{event.summary}</strong><span className="case-activity-meta"><span>{event.actorDisplayName}</span><time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time></span></div></div>)}</div></section>
    {toast && <Toast title={toast.title} subtitle={toast.subtitle} tone={toast.tone} onDismiss={() => setToast(null)} />}
    <ConfirmationDialog open={Boolean(dialog)} title={dialog === "resubmit" ? "Update Case Details" : dialog === "delete_case" ? "Delete This Case?" : dialog === "cancel" ? "Cancel This Case?" : dialog === "request_changes" ? "Request Changes?" : dialog === "verify_deposit" ? "Review Deposit" : dialog === "propose_installation_date" ? "Set Installation Date" : dialog === "confirm_installation_date" ? "Confirm Installation Date" : dialog === "request_installation_date_change" ? "Request Different Date" : dialog === "verify_payment" ? "Record Payment" : dialog === "record_installation" ? "Record Installation" : dialog === "verify_savings" ? "Verify Savings" : dialog === "accept_trial" ? "Accept Trial" : "Start Quotation Details"} description={dialog === "resubmit" ? "Review and update the customer and service information before submitting this case for review again." : dialog === "delete_case" ? "This permanently deletes the case and its uploaded documents. This action cannot be undone." : dialog === "cancel" ? "Cancellation is permanent and unpaid commissions will be withheld." : dialog === "request_changes" ? "The agent will be able to edit and resubmit this case after you provide the correction request." : dialog === "verify_deposit" ? "Review the agent-submitted deposit before applying it to the case." : dialog === "propose_installation_date" ? "Choose a date for the agent to review and confirm." : dialog === "confirm_installation_date" ? "Confirm that the proposed installation date works for the customer." : dialog === "request_installation_date_change" ? "Tell staff why the proposed installation date does not work." : dialog === "verify_payment" ? "Enter the payment details. Staff verification is required before it affects the schedule." : dialog === "record_installation" ? "Enter the installation payment amount and installation date." : dialog === "verify_savings" ? "Enter the verified savings values before moving this case to trial review." : dialog === "accept_trial" ? "Choose the installment start date and term before accepting the trial and generating commissions." : "Enter the quotation values and initial payment dates before starting quotation."} confirmLabel={dialog === "resubmit" ? "Submit" : dialog === "delete_case" ? "Delete Case" : dialog === "cancel" ? "Cancel Case" : dialog === "request_changes" ? "Request Changes" : dialog === "verify_deposit" ? "Verify Deposit" : dialog === "propose_installation_date" ? "Send Date to Agent" : dialog === "confirm_installation_date" ? "Confirm Date" : dialog === "request_installation_date_change" ? "Request Different Date" : dialog === "verify_payment" ? "Record Payment" : dialog === "record_installation" ? "Record Installation" : dialog === "verify_savings" ? "Move to Trial" : dialog === "accept_trial" ? "Accept Trial and Generate Commissions" : "Start Quotation"} confirmVariant={dialog === "delete_case" || dialog === "cancel" ? "danger" : "primary"} confirmDisabled={busy || (dialog === "pass_review" && Boolean(quoteError)) || (dialog === "verify_deposit" && (!pendingPayment || !depositSchedule)) || (dialog === "propose_installation_date" && !installationProposalDate) || (dialog === "verify_payment" && Boolean(paymentError)) || (dialog === "record_installation" && (!installationDate || (postInstallationBalanceSen > 0 && !installationPaymentAmount.trim()))) || (dialog === "verify_savings" && Boolean(savingsError)) || (dialog === "accept_trial" && !installmentStart) || (dialog === "resubmit" && Boolean(resubmitError))} reason={reason} reasonRequired={dialog === "cancel" || dialog === "request_changes" || dialog === "request_installation_date_change"} reasonLabel={dialog === "verify_deposit" ? "Rejection reason (only needed to reject)" : undefined} onReasonChange={dialog === "cancel" || dialog === "request_changes" || dialog === "verify_deposit" || dialog === "request_installation_date_change" ? setReason : undefined} onCancel={closeDialog} onConfirm={() => dialog && run(dialog)}>
      {dialog === "verify_deposit" && <div className="case-dialog-fields"><div className="case-payment-summary"><span>Submitted deposit</span><strong>{pendingPayment ? formatMoney(pendingPayment.amountSen) : "Not Available"}</strong></div>{pendingPayment && <div className="case-form-grid"><ReadOnlyField id="deposit-payment-date" title="Payment Date" value={pendingPayment.paymentDate} /><ReadOnlyField id="deposit-reference" title="Reference" value={pendingPayment.reference ?? "Not provided"} /></div>}{paymentError && <p className="case-field-error-message" role="alert">{paymentError}</p>}<Button type="button" variant="danger" onClick={rejectDeposit} disabled={busy || !reason.trim()}>Reject Deposit</Button></div>}
      {dialog === "propose_installation_date" && <div className="case-dialog-fields"><DatePicker id="installation-proposal-date" title="Installation Date" value={installationProposalDate} placeholder="DD/MM/YYYY" onChange={(value) => { setPaymentError(null); setInstallationProposalDate(value); }} required />{caseDetail.installationDateFeedback && <p className="case-field-error-message">Agent feedback: {caseDetail.installationDateFeedback}</p>}</div>}
      {dialog === "confirm_installation_date" && <div className="case-dialog-fields"><ReadOnlyField id="proposed-installation-date" title="Proposed Installation Date" value={caseDetail.installationProposedDate ?? "Not available"} /></div>}
      {dialog === "verify_payment" && <div className="case-dialog-fields"><div className="case-payment-summary"><span>Pending Payment</span><strong>{pendingPayment ? formatMoney(pendingPayment.amountSen) : "Not Available"}</strong></div><div className="case-allocation-list">{allocatableSchedules.length ? allocatableSchedules.map((schedule) => <div className="case-field" key={schedule.id}><label htmlFor={`allocation-${schedule.id}`}>Schedule {schedule.sequence} · {titleCase(schedule.kind)}</label><span className="case-allocation-balance">Remaining Balance: {formatMoney(schedule.amountDueSen - schedule.amountPaidSen)}</span><MoneyInput id={`allocation-${schedule.id}`} inputMode="decimal" value={allocations[schedule.id] ?? ""} onChange={(event) => { setAllocationError(null); setAllocations((current) => ({ ...current, [schedule.id]: event.target.value })); }} aria-invalid={Boolean(allocationError)} aria-describedby={allocationError ? "payment-allocation-error" : undefined} /></div>) : <p className="detail-empty">No outstanding payment schedules are available.</p>}</div>{allocationError && <p id="payment-allocation-error" className="case-field-error-message" role="alert">{allocationError}</p>}</div>}
      {dialog === "pass_review" && <div className="case-dialog-fields"><div className="case-form-grid"><MoneyInput id="pass-review-sale-amount" title="Sale Amount" inputMode="decimal" value={saleAmount} onChange={(event) => { setQuoteError(null); setSaleAmount(event.target.value); }} aria-invalid={Boolean(quoteError)} aria-describedby={quoteError ? "pass-review-quote-error" : undefined} required /><MoneyInput id="pass-review-monthly-savings" title="Quoted Monthly Savings" inputMode="decimal" value={quotedMonthlySavings} onChange={(event) => { setQuoteError(null); setQuotedMonthlySavings(event.target.value); }} aria-invalid={Boolean(quoteError)} aria-describedby={quoteError ? "pass-review-quote-error" : undefined} required /><DatePicker id="deposit-due" title="Deposit Due" value={depositDue} placeholder="DD/MM/YYYY" onChange={(value) => { setQuoteError(null); setDepositDue(value); }} required /><DatePicker id="post-installation-due" title="Post-Installation Due" value={postInstallationDue} placeholder="DD/MM/YYYY" onChange={(value) => { setQuoteError(null); setPostInstallationDue(value); }} required /></div>{quoteError && <p id="pass-review-quote-error" className="case-field-error-message" role="alert">{quoteError}</p>}</div>}
      {dialog === "resubmit" && <div className="case-dialog-fields">{latestStaffRemark ? <ReadOnlyField id="staff-review-remark" title="Staff Remarks" value={latestStaffRemark} multiline /> : <p className="detail-empty">No staff remarks were provided.</p>}<div className="case-form-grid"><TextInput title="Company Name" value={customerName} onChange={(event) => { setResubmitError(null); setCustomerName(event.target.value); }} required /><TextInput title="Company Email Address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /><TextInput title="Contact Person Name" value={contactName} onChange={(event) => setContactName(event.target.value)} /><TextInput title="Contact Person Phone Number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /><TextArea title="Service Address" value={siteAddress} onChange={(event) => { setResubmitError(null); setSiteAddress(event.target.value); }} required /><TextArea title="Additional Remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} /></div>{resubmitError && <p className="case-field-error-message" role="alert">{resubmitError}</p>}</div>}
      {dialog === "accept_trial" && <div className="case-dialog-fields"><div className="case-form-grid"><DatePicker id="installment-start" title="Installments Start" value={installmentStart} placeholder="DD/MM/YYYY" onChange={setInstallmentStart} required /><FilterSelect title="Term" allLabel="Select term" value={String(termMonths) as "10" | "20"} options={["10", "20"]} labels={{ "10": "10 months", "20": "20 months" }} onChange={(value) => setTermMonths(Number(value) as 10 | 20)} required /></div></div>}
      {dialog === "verify_savings" && <div className="case-dialog-fields"><div className="case-form-grid"><TextInput title="Verified Savings (kWh)" inputMode="decimal" value={savingsKwh} onChange={(event) => { setSavingsError(null); setSavingsKwh(event.target.value); }} aria-invalid={Boolean(savingsError)} aria-describedby={savingsError ? "verify-savings-error" : undefined} required /><MoneyInput title="Monthly Savings" inputMode="decimal" value={monthlySavings} onChange={(event) => { setSavingsError(null); setMonthlySavings(event.target.value); }} aria-invalid={Boolean(savingsError)} aria-describedby={savingsError ? "verify-savings-error" : undefined} required /></div>{savingsError && <p id="verify-savings-error" className="case-field-error-message" role="alert">{savingsError}</p>}</div>}
      {dialog === "record_installation" && <div className="case-dialog-fields"><div className="case-form-grid"><MoneyInput id="record-installation-payment" title="Payment Amount" inputMode="decimal" value={installationPaymentAmount} onChange={(event) => { setPaymentError(null); setInstallationPaymentAmount(event.target.value); }} aria-invalid={Boolean(paymentError)} aria-describedby={paymentError ? "record-installation-error" : undefined} required /><DatePicker id="record-installation-date" title="Installation Date" value={installationDate} placeholder="DD/MM/YYYY" onChange={(value) => { setPaymentError(null); setInstallationDate(value); }} required /></div>{paymentError && <p id="record-installation-error" className="case-field-error-message" role="alert">{paymentError}</p>}</div>}
    </ConfirmationDialog>
    <ConfirmationDialog open={recordPaymentOpen} title="Record Deposit" description="Submit the deposit for staff verification. It will not be applied to the case until staff approve it." confirmLabel="Submit Deposit" confirmVariant="primary" confirmDisabled={busy || Boolean(paymentError)} onCancel={closeRecordPayment} onConfirm={recordPayment}>
      <div className="case-dialog-fields"><MoneyInput id="record-payment-amount" title="Deposit Amount" inputMode="decimal" value={paymentAmount} onChange={(event) => { setPaymentError(null); setPaymentAmount(event.target.value); }} aria-invalid={Boolean(paymentError)} aria-describedby={paymentError ? "record-payment-error" : undefined} required /><DatePicker id="record-payment-date" title="Payment Date" value={paymentDate} placeholder="DD/MM/YYYY" onChange={(value) => { setPaymentError(null); setPaymentDate(value); }} required /><TextInput id="record-payment-reference" title="Payment Reference" value={paymentReference} onChange={(event) => { setPaymentError(null); setPaymentReference(event.target.value); }} /><p className="case-field-hint">Staff will review this deposit before it is marked as paid.</p>{paymentError && <p id="record-payment-error" className="case-field-error-message" role="alert">{paymentError}</p>}</div>
    </ConfirmationDialog>
  </div>;
}
