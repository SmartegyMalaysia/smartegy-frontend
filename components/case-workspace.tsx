"use client";

import { useEffect, useState } from "react";
import { Button, ConfirmationDialog, Badge } from "./ui";
import { MoneyInput, ReadOnlyField, TextInput, TextArea } from "./form-controls";
import { DatePicker } from "./date-picker";
import { FilterSelect } from "./filter-select";
import { Toast, type ToastTone } from "./toast";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { malaysiaStates } from "@/lib/malaysia";
import { casesRepository } from "@/lib/case-repository";
import { canEditCase, caseActionLabels, type CaseActionKind } from "@/lib/case-workflow";
import type { CaseDetail, CurrentUser } from "@/lib/types";
import { ProposalForm } from "./proposal-form";
import { ProposalAcceptance } from "./proposal-acceptance";

type CaseToast = { title: string; subtitle: string; tone: ToastTone };

function moneyInputValue(value: number | null | undefined) { return value == null ? "" : String(value / 100); }
function uploadedDocumentLabel(type: string) { return type === "electricity_bill" ? "Electricity bill" : type === "signed_proposal" ? "Signed proposal" : "Supporting"; }
function uploadedDocumentTag(type: string) { return type === "electricity_bill" ? "document-tag-electricity" : type === "signed_proposal" ? "document-tag-signed" : "document-tag-supporting"; }
function generatedDocumentLabel(type: string) { return type === "quotation" ? "Proposal" : type === "invoice" ? "Invoice" : "Receipt"; }
function generatedDocumentTag(type: string) { return type === "quotation" ? "document-tag-proposal" : type === "invoice" ? "document-tag-invoice" : "document-tag-receipt"; }

export function CaseWorkspace({ initialCase, user, onChanged, onDeleted }: { initialCase: CaseDetail; user: CurrentUser; onChanged: (value: CaseDetail) => void; onDeleted: () => void }) {
  const [caseDetail, setCaseDetail] = useState(initialCase);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<CaseToast | null>(null);
  const [dialog, setDialog] = useState<CaseActionKind | null>(null);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [acceptanceOpen, setAcceptanceOpen] = useState(false);
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
  const [termMonths, setTermMonths] = useState<10 | 20>(initialCase.proposal?.selectedTermMonths ?? initialCase.installmentTermMonths ?? 10);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [installationPaymentAmount, setInstallationPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const canEditDetails = user.role !== "agent" && canEditCase(user, initialCase.status, initialCase.agentId);
  const [editing, setEditing] = useState(false);
  const [customerName, setCustomerName] = useState(initialCase.customer.displayName);
  const [contactName, setContactName] = useState(initialCase.customer.contactName ?? "");
  const [email, setEmail] = useState(initialCase.customer.email ?? "");
  const [phone, setPhone] = useState(initialCase.customer.phone ?? "");
  const [siteAddress, setSiteAddress] = useState(initialCase.service.siteAddress);
  const [addressLine1, setAddressLine1] = useState(initialCase.service.addressLine1);
  const [addressLine2, setAddressLine2] = useState(initialCase.service.addressLine2);
  const [postcode, setPostcode] = useState(initialCase.service.postcode);
  const [city, setCity] = useState(initialCase.service.city);
  const [state, setState] = useState(initialCase.service.state);
  const [remarks, setRemarks] = useState(initialCase.service.notes ?? "");
  const [saleAmount, setSaleAmount] = useState(moneyInputValue(initialCase.quote?.saleAmountSen ?? initialCase.saleAmountSen));
  const [quotedMonthlySavings, setQuotedMonthlySavings] = useState(moneyInputValue(initialCase.quote?.quotedMonthlySavingsSen));
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const depositPaid = Boolean(caseDetail.paymentSchedules?.some((schedule) => schedule.kind === "deposit" && schedule.amountPaidSen >= schedule.amountDueSen));
  const actions = caseActionLabels(caseDetail.status, user.role, Boolean(caseDetail.paymentSchedules?.length), depositPaid);
  const latestStaffRemark = [...caseDetail.activity].reverse().find((event) => event.reason?.trim())?.reason ?? null;
  const pendingPayment = caseDetail.payments?.find((payment) => payment.status === "pending_verification");
  const depositSchedule = (caseDetail.paymentSchedules ?? []).find((schedule) => schedule.kind === "deposit" && schedule.amountDueSen > schedule.amountPaidSen);
  const postInstallationSchedule = (caseDetail.paymentSchedules ?? []).find((schedule) => schedule.kind === "post_installation");
  const allocatableSchedules = (caseDetail.paymentSchedules ?? []).filter((schedule) => schedule.amountDueSen > schedule.amountPaidSen);

  useEffect(() => { setDialog(null); setRecordPaymentOpen(false); setProposalOpen(false); setAcceptanceOpen(false); setEditing(false); setReason(""); setQuoteError(null); setPaymentError(null); setAllocationError(null); setSavingsError(null); setResubmitError(null); setDetailsError(null); setTermMonths(initialCase.proposal?.selectedTermMonths ?? initialCase.installmentTermMonths ?? 10); }, [initialCase.id, initialCase.proposal?.selectedTermMonths, initialCase.installmentTermMonths]);

  function showError(message: string, title = "Action Failed") { setToast({ title, subtitle: message, tone: "error" }); }
  function syncQuoteFields(value: CaseDetail) {
    setSaleAmount(moneyInputValue(value.quote?.saleAmountSen ?? value.saleAmountSen));
    setQuotedMonthlySavings(moneyInputValue(value.quote?.quotedMonthlySavingsSen));
  }
  function syncCaseFields(value: CaseDetail) {
    setCustomerName(value.customer.displayName);
    setContactName(value.customer.contactName ?? "");
    setEmail(value.customer.email ?? "");
    setPhone(value.customer.phone ?? "");
    setSiteAddress(value.service.siteAddress);
    setAddressLine1(value.service.addressLine1);
    setAddressLine2(value.service.addressLine2);
    setPostcode(value.service.postcode);
    setCity(value.service.city);
    setState(value.service.state);
    setRemarks(value.service.notes ?? "");
  }
  function setCaseData(value: CaseDetail) { setCaseDetail(value); onChanged(value); syncQuoteFields(value); syncCaseFields(value); }
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
    if (action === "pass_review") { setProposalOpen(true); return; }
    if (action === "accept_proposal") { setAcceptanceOpen(true); return; }
    if (action === "verify_payment") { openRecordPayment(); return; }
    if (action === "record_installation") { setPaymentError(null); setInstallationPaymentAmount(moneyInputValue(postInstallationBalanceSen)); }
    if (action === "verify_savings") setSavingsError(null);
    if (action === "resubmit") setResubmitError(null);
    setDialog(action);
  }
  function closeDialog() { setDialog(null); setRecordPaymentOpen(false); setReason(""); setQuoteError(null); setPaymentError(null); setAllocationError(null); setSavingsError(null); setResubmitError(null); }
  function openRecordPayment() { setDialog(null); setPaymentError(null); setPaymentAmount(moneyInputValue(depositBalanceSen)); setPaymentDate(pendingPayment?.paymentDate ?? new Date().toISOString().slice(0, 10)); setRecordPaymentOpen(true); }
  function closeRecordPayment() { setRecordPaymentOpen(false); setDialog(null); setPaymentError(null); }
  function apply(result: Awaited<ReturnType<typeof casesRepository.getById>>) {
    if (result.ok) { setCaseData(result.data); setToast({ title: "Case Updated", subtitle: "The case changes were saved successfully.", tone: "success" }); closeDialog(); }
    else showError(result.error.message);
  }
  function getResubmitInput() {
    if (!customerName.trim() || !addressLine1.trim() || !postcode.trim() || !city.trim() || !state) {
      setResubmitError("Complete the required customer and service details.");
      return false;
    }
    setResubmitError(null);
    const updatedSiteAddress = [addressLine1, addressLine2, [postcode, city].filter(Boolean).join(" "), state].filter(Boolean).join(", ");
    return { customer: { displayName: customerName, contactName, email, phone }, service: { siteAddress: updatedSiteAddress, addressLine1, addressLine2, postcode, city, state, notes: remarks } };
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
    else if (action === "verify_payment") {
      const amount = Number(paymentAmount);
      if (!paymentAmount.trim() || !Number.isFinite(amount) || amount <= 0 || !paymentDate) { setPaymentError("Payment amount and payment date are required."); setBusy(false); return; }
      if (Math.round(amount * 100) > depositBalanceSen) { setPaymentError(`Payment amount cannot exceed the remaining deposit balance of ${formatMoney(depositBalanceSen)}.`); setBusy(false); return; }
      result = await casesRepository.recordAndVerifyPayment(user, caseDetail.id, { amountSen: Math.round(amount * 100), paymentDate });
    } else if (action === "record_installation") {
      const amount = Number(installationPaymentAmount);
      if (postInstallationBalanceSen > 0 && (!installationPaymentAmount.trim() || !Number.isFinite(amount) || amount <= 0 || !installationDate)) {
        setPaymentError("Payment amount and installation date are required.");
        setBusy(false);
        return;
      }
      if (postInstallationBalanceSen > 0 && Math.round(amount * 100) > postInstallationBalanceSen) {
        setPaymentError(`Payment amount cannot exceed the remaining post-installation balance of ${formatMoney(postInstallationBalanceSen)}.`);
        setBusy(false);
        return;
      }
      const completeInstallation = async () => {
        if (caseDetail.status === "awaiting_deposit") {
          const scheduled = await casesRepository.transition(user, caseDetail.id, "installation_scheduled");
          return scheduled.ok ? casesRepository.recordInstallation(user, caseDetail.id, installationDate) : scheduled;
        }
        return casesRepository.recordInstallation(user, caseDetail.id, installationDate);
      };
      if (postInstallationBalanceSen > 0) {
        const payment = await casesRepository.recordAndVerifyPayment(user, caseDetail.id, { amountSen: Math.round(amount * 100), paymentDate: installationDate });
        if (!payment.ok) {
          result = payment;
        } else {
          const remainingPostInstallation = payment.data.paymentSchedules?.find((schedule) => schedule.kind === "post_installation");
          result = remainingPostInstallation && remainingPostInstallation.amountPaidSen < remainingPostInstallation.amountDueSen
            ? payment
            : await completeInstallation();
        }
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
    if (!result.ok && (action === "verify_payment" || action === "record_installation")) setPaymentError(result.error.message);
    apply(result);
    setBusy(false);
  }
  async function saveDetails() {
    if (!customerName.trim() || !addressLine1.trim() || !postcode.trim() || !city.trim() || !state) {
      setDetailsError("Complete the required customer and service details.");
      return;
    }
    setDetailsError(null);
    setBusy(true);
    setToast(null);
    const result = await casesRepository.update(user, caseDetail.id, { customer: { displayName: customerName, contactName, email, phone }, service: { siteAddress, addressLine1, addressLine2, postcode, city, state, notes: remarks } });
    apply(result);
    setBusy(false);
    if (result.ok) setEditing(false);
  }
  async function recordPayment() {
    const amount = Number(paymentAmount);
    if (!paymentAmount.trim() || !Number.isFinite(amount) || amount <= 0 || !paymentDate) { setPaymentError("Payment amount and payment date are required."); return; }
    if (Math.round(amount * 100) > depositBalanceSen) { setPaymentError(`Payment amount cannot exceed the remaining deposit balance of ${formatMoney(depositBalanceSen)}.`); return; }
    setBusy(true);
    setToast(null);
    const result = await casesRepository.recordAndVerifyPayment(user, caseDetail.id, { amountSen: Math.round(amount * 100), paymentDate });
    if (result.ok) closeRecordPayment();
    else setPaymentError(result.error.message);
    apply(result);
    setBusy(false);
  }
  async function downloadDocument(documentId: string) {
    const result = await casesRepository.getDocumentUrl(user, caseDetail.id, documentId);
    if (!result.ok) { showError(result.error.message, "Document Access Failed"); return; }
    const anchor = window.document.createElement("a");
    anchor.href = result.data;
    anchor.download = result.data.split("/").pop()?.split("?")[0] || `document-${documentId}`;
    anchor.rel = "noopener noreferrer";
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
  async function getTimelineDocumentIds(document: { id: string; documentIds: string[]; regenerateType: "quotation" | "proforma" | null; sourceId?: string }) {
    let documentIds = document.documentIds;
    if (document.regenerateType && documentIds.length < 2) {
      const generated = await casesRepository.generateFinancialDocument(user, caseDetail.id, document.regenerateType, document.regenerateType === "proforma" ? document.sourceId : undefined);
      if (!generated.ok) { showError(generated.error.message, "Document Access Failed"); return null; }
      const refreshed = await casesRepository.getById(user, caseDetail.id);
      if (!refreshed.ok) { showError(refreshed.error.message, "Document Access Failed"); return null; }
      setCaseData(refreshed.data);
      const refreshedDocument = refreshed.data.financialDocuments?.find((item) => item.id === document.id);
      documentIds = [refreshedDocument?.caseDocumentId].filter((id): id is string => Boolean(id));
    }
    if (!documentIds.length) { showError("No downloadable files are attached to this document.", "Document Access Failed"); return null; }
    return documentIds;
  }
  async function downloadTimelineDocument(document: { id: string; documentIds: string[]; regenerateType: "quotation" | "proforma" | null; sourceId?: string }) {
    const documentIds = await getTimelineDocumentIds(document);
    if (documentIds?.[0]) await downloadDocument(documentIds[0]);
  }
  async function generateDocument(type: "proforma" | "receipt", paymentScheduleId?: string, paymentId?: string) {
    setBusy(true); setToast(null);
    const result = await casesRepository.generateFinancialDocument(user, caseDetail.id, type, paymentScheduleId, paymentId);
    if (result.ok) { const refreshed = await casesRepository.getById(user, caseDetail.id); if (refreshed.ok) setCaseData(refreshed.data); setToast({ title: "Document Generated", subtitle: `${result.data.documentNumber} is ready in the generated documents list.`, tone: "success" }); }
    else showError(result.error.message, "Document Generation Failed");
    setBusy(false);
  }
  const documentRows = [
    ...caseDetail.documents.map((document) => ({ kind: "uploaded" as const, id: document.id, date: document.uploadedAt, label: uploadedDocumentLabel(document.type), tag: uploadedDocumentTag(document.type), name: document.fileName, detail: `${Math.ceil(document.sizeBytes / 1024)} KB`, documentIds: [document.id], regenerateType: null })),
    ...(caseDetail.financialDocuments ?? []).map((document) => ({ kind: "generated" as const, id: document.id, date: document.createdAt, label: generatedDocumentLabel(document.type), tag: generatedDocumentTag(document.type), name: document.documentNumber, detail: `${formatMoney(document.amountSen)} - ${titleCase(document.status)}`, documentIds: [document.caseDocumentId].filter((id): id is string => Boolean(id)), regenerateType: document.type === "quotation" ? "quotation" as const : document.type === "invoice" ? "proforma" as const : null, sourceId: document.sourceId })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return <div className="case-workspace">
    <div className="case-action-panel panel">
      <div className="panel-header"><div><h2>Next Actions</h2><p>Available actions depend on this case’s current stage and your role. Required details, payments, and approvals must be completed before the case can advance.</p></div></div>

      <div className="case-action-list">{actions.map((action) => <Button key={action.kind} type="button" variant={action.variant} disabled={busy} onClick={() => action.requiresReason || action.kind === "pass_review" || action.kind === "accept_proposal" || action.kind === "verify_payment" || action.kind === "record_installation" || action.kind === "verify_savings" || action.kind === "accept_trial" || action.kind === "delete_case" || action.kind === "resubmit" ? openDialog(action.kind) : run(action.kind)}>{action.label}</Button>)}</div>
    </div>
    <div className="case-detail-grid">
      <section className="panel case-form-panel"><div className="panel-header"><div><h2>Customer and Service</h2><p>Submitted {formatDate(caseDetail.submittedAt)} by {caseDetail.agentName}</p></div>{canEditDetails && <Button type="button" variant="secondary" size="sm" onClick={() => { setDetailsError(null); setEditing(!editing); }}>{editing ? "Cancel Edit" : "Edit Details"}</Button>}</div>{editing ? <div className="case-form-body"><div className="case-form-grid"><TextInput id="edit-company-name" title="Company Name" value={customerName} onChange={(event) => { setDetailsError(null); setCustomerName(event.target.value); }} required /><TextInput id="edit-company-email" title="Company Email Address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><TextInput id="edit-contact-person-name" title="Contact Person Name" value={contactName} onChange={(event) => setContactName(event.target.value)} required /><TextInput id="edit-contact-person-phone" title="Contact Person Phone Number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /><TextInput id="edit-address-line-1" title="Address Line 1" value={addressLine1} onChange={(event) => { setDetailsError(null); setAddressLine1(event.target.value); }} required autoComplete="address-line1" /><TextInput id="edit-address-line-2" title="Address Line 2" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} autoComplete="address-line2" /><TextInput id="edit-postcode" title="Postcode" value={postcode} onChange={(event) => { setDetailsError(null); setPostcode(event.target.value); }} required autoComplete="postal-code" /><TextInput id="edit-city" title="City" value={city} onChange={(event) => { setDetailsError(null); setCity(event.target.value); }} required autoComplete="address-level2" /><FilterSelect title="State" allLabel="Select state" value={state} options={[...malaysiaStates]} onChange={(value) => { setDetailsError(null); setState(value); }} required /><TextArea id="edit-additional-remarks" title="Additional Remarks" rows={1} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Add context for staff if needed" /></div>{detailsError && <p className="case-field-error-message" role="alert">{detailsError}</p>}<Button type="button" onClick={saveDetails} disabled={busy}>Save Details</Button></div> : <dl className="case-detail-list"><div><dt>Company Name</dt><dd>{caseDetail.customer.displayName}</dd></div><div><dt>Contact</dt><dd>{caseDetail.customer.contactName ?? "Not provided"}</dd></div><div><dt>Email</dt><dd>{caseDetail.customer.email ?? "Not provided"}</dd></div><div><dt>Phone</dt><dd>{caseDetail.customer.phone ?? "Not provided"}</dd></div><div><dt>Service Address</dt><dd>{caseDetail.service.siteAddress || "Not provided"}</dd></div><div><dt>Remarks</dt><dd>{caseDetail.service.notes || "No remarks provided."}</dd></div></dl>}</section>
      <section className="panel case-form-panel"><div className="panel-header"><div><h2>Documents</h2><p>Uploads and generated files in chronological order.</p></div></div><div className="case-documents-timeline">{documentRows.length ? documentRows.map((document) => <div className="case-document-timeline-row" key={`${document.kind}-${document.id}`}><span className="case-document-timeline-dot" aria-hidden="true" /><div className={`case-document-timeline-content ${document.tag}`}><div className="case-document-timeline-meta"><span className={`document-tag ${document.tag}`}>{document.label}</span><time dateTime={document.date}>{formatDate(document.date)}</time></div><div className="case-document-timeline-file"><div><strong>{document.name}</strong><span>{document.detail}</span></div>{(document.documentIds.length > 0 || document.regenerateType) && <Button type="button" variant="ghost" size="sm" onClick={() => downloadTimelineDocument(document)}>Download DOCX</Button>}</div></div></div>) : <p className="detail-empty">No documents yet.</p>}{depositSchedule && !caseDetail.financialDocuments?.some((document) => document.type === "invoice" && document.sourceId === depositSchedule.id && document.status === "issued") && <Button type="button" variant="secondary" size="sm" onClick={() => generateDocument("proforma", depositSchedule.id)} disabled={busy}>Generate Deposit Invoice</Button>}{caseDetail.payments?.filter((payment) => payment.status === "verified" && !caseDetail.financialDocuments?.some((document) => document.type === "receipt" && document.sourceId === payment.id && document.status === "issued")).map((payment) => <Button type="button" variant="secondary" size="sm" key={`receipt-${payment.id}`} onClick={() => generateDocument("receipt", undefined, payment.id)} disabled={busy}>Generate Receipt - {payment.id.slice(0, 8)}</Button>)}</div></section>
    </div>
    <div className="case-detail-grid"><section className="panel case-form-panel"><div className="panel-header"><div><h2>Quote, Savings and Installation</h2><p>Operational values used by the workflow.</p></div></div><dl className="case-detail-list"><div><dt>Sale amount</dt><dd>{formatMoney(caseDetail.quote?.saleAmountSen ?? caseDetail.saleAmountSen)}</dd></div><div><dt>Quoted monthly savings</dt><dd>{caseDetail.quote?.quotedMonthlySavingsSen == null ? "Not provided" : formatMoney(caseDetail.quote.quotedMonthlySavingsSen)}</dd></div><div><dt>Verified savings</dt><dd>{caseDetail.verifiedSavings?.monthlySavingsSen == null ? "Not verified" : `${formatMoney(caseDetail.verifiedSavings.monthlySavingsSen)} / month`}</dd></div><div><dt>Installation date</dt><dd>{caseDetail.installationDate ?? "Not scheduled"}</dd></div><div><dt>Installment term</dt><dd>{caseDetail.installmentTermMonths ? `${caseDetail.installmentTermMonths} months` : "Not started"}</dd></div></dl></section><section className="panel case-form-panel"><div className="panel-header"><div><h2>Payment Schedule</h2><p>Initial obligations and installments</p></div></div><div className="case-schedule-list">{caseDetail.paymentSchedules?.length ? caseDetail.paymentSchedules.map((schedule) => <div className="case-schedule-row" key={schedule.id}><span>{schedule.sequence}. {titleCase(schedule.kind)}<small>{schedule.dueDate}</small></span><span>{formatMoney(schedule.amountPaidSen)} / {formatMoney(schedule.amountDueSen)} <Badge status={schedule.status === "paid" ? "verified" : "pending_verification"} /></span></div>) : <p className="detail-empty">No payment schedule generated.</p>}</div></section></div>
    <section className="panel case-form-panel"><div className="panel-header"><div><h2>Status Timeline</h2><p>Full case audit history</p></div></div><div className="case-detail-activity">{caseDetail.activity.map((event) => <div key={event.id}><span className="case-activity-dot" aria-hidden="true" /><div className="case-activity-content"><strong>{event.summary}</strong><span className="case-activity-meta"><span>{event.actorDisplayName}</span><time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time></span></div></div>)}</div></section>
    {toast && <Toast title={toast.title} subtitle={toast.subtitle} tone={toast.tone} onDismiss={() => setToast(null)} />}
    <ConfirmationDialog open={Boolean(dialog)} size={dialog === "resubmit" ? "lg" : "md"} title={dialog === "resubmit" ? "Update Case Details" : dialog === "delete_case" ? "Delete This Case?" : dialog === "cancel" ? "Cancel This Case?" : dialog === "request_changes" ? "Request Changes?" : dialog === "verify_payment" ? "Record Deposit" : dialog === "record_installation" ? "Record Installation" : dialog === "verify_savings" ? "Verify Savings" : dialog === "accept_trial" ? "Accept Trial" : "Start Quotation Details"} description={dialog === "resubmit" ? "Review and update the customer and service information before submitting this case for review again." : dialog === "delete_case" ? "This permanently deletes the case and its uploaded documents. This action cannot be undone." : dialog === "cancel" ? "Cancellation is permanent and unpaid commissions will be withheld." : dialog === "request_changes" ? "The agent will be able to edit and resubmit this case after you provide the correction request." : dialog === "verify_payment" ? "Enter the deposit amount and date. The deposit will be allocated automatically and confirmed immediately." : dialog === "record_installation" ? "Enter the installation payment amount and installation date." : dialog === "verify_savings" ? "Enter the verified savings values before moving this case to trial review." : dialog === "accept_trial" ? "Choose the installment start date and term before accepting the trial and generating commissions." : "Enter the quotation values and initial payment dates before starting quotation."} confirmLabel={dialog === "resubmit" ? "Submit" : dialog === "delete_case" ? "Delete Case" : dialog === "cancel" ? "Cancel Case" : dialog === "request_changes" ? "Request Changes" : dialog === "verify_payment" ? "Confirm Deposit" : dialog === "record_installation" ? "Record Installation" : dialog === "verify_savings" ? "Move to Trial" : dialog === "accept_trial" ? "Accept Trial and Generate Commissions" : "Start Quotation"} confirmVariant={dialog === "delete_case" || dialog === "cancel" ? "danger" : "primary"} loading={busy} confirmDisabled={(dialog === "pass_review" && Boolean(quoteError)) || (dialog === "verify_payment" && Boolean(paymentError)) || (dialog === "record_installation" && (!installationDate || (postInstallationBalanceSen > 0 && !installationPaymentAmount.trim()))) || (dialog === "verify_savings" && Boolean(savingsError)) || (dialog === "accept_trial" && !installmentStart) || (dialog === "resubmit" && Boolean(resubmitError))} reason={reason} reasonRequired={dialog === "cancel" || dialog === "request_changes"} onReasonChange={dialog === "cancel" || dialog === "request_changes" ? setReason : undefined} onCancel={closeDialog} onConfirm={() => dialog && run(dialog)}>
      {dialog === "verify_payment" && <div className="case-dialog-fields"><div className="case-payment-summary"><span>Pending Payment</span><strong>{pendingPayment ? formatMoney(pendingPayment.amountSen) : "Not Available"}</strong></div><div className="case-allocation-list">{allocatableSchedules.length ? allocatableSchedules.map((schedule) => <div className="case-field" key={schedule.id}><label htmlFor={`allocation-${schedule.id}`}>Schedule {schedule.sequence} · {titleCase(schedule.kind)}</label><span className="case-allocation-balance">Remaining Balance: {formatMoney(schedule.amountDueSen - schedule.amountPaidSen)}</span><MoneyInput id={`allocation-${schedule.id}`} inputMode="decimal" value={allocations[schedule.id] ?? ""} onChange={(event) => { setAllocationError(null); setAllocations((current) => ({ ...current, [schedule.id]: event.target.value })); }} aria-invalid={Boolean(allocationError)} aria-describedby={allocationError ? "payment-allocation-error" : undefined} /></div>) : <p className="detail-empty">No outstanding payment schedules are available.</p>}</div>{allocationError && <p id="payment-allocation-error" className="case-field-error-message" role="alert">{allocationError}</p>}</div>}
      {dialog === "pass_review" && <div className="case-dialog-fields"><div className="case-form-grid"><MoneyInput id="pass-review-sale-amount" title="Sale Amount" inputMode="decimal" value={saleAmount} onChange={(event) => { setQuoteError(null); setSaleAmount(event.target.value); }} aria-invalid={Boolean(quoteError)} aria-describedby={quoteError ? "pass-review-quote-error" : undefined} required /><MoneyInput id="pass-review-monthly-savings" title="Quoted Monthly Savings" inputMode="decimal" value={quotedMonthlySavings} onChange={(event) => { setQuoteError(null); setQuotedMonthlySavings(event.target.value); }} aria-invalid={Boolean(quoteError)} aria-describedby={quoteError ? "pass-review-quote-error" : undefined} required /><DatePicker id="deposit-due" title="Deposit Due" value={depositDue} placeholder="DD/MM/YYYY" onChange={(value) => { setQuoteError(null); setDepositDue(value); }} required /><DatePicker id="post-installation-due" title="Post-Installation Due" value={postInstallationDue} placeholder="DD/MM/YYYY" onChange={(value) => { setQuoteError(null); setPostInstallationDue(value); }} required /></div>{quoteError && <p id="pass-review-quote-error" className="case-field-error-message" role="alert">{quoteError}</p>}</div>}
      {dialog === "resubmit" && <div className="case-dialog-fields">{latestStaffRemark ? <ReadOnlyField id="staff-review-remark" title="Staff Remarks" value={latestStaffRemark} multiline /> : <p className="detail-empty">No staff remarks were provided.</p>}<div className="case-form-grid"><TextInput id="resubmit-company-name" title="Company Name" value={customerName} onChange={(event) => { setResubmitError(null); setCustomerName(event.target.value); }} required /><TextInput id="resubmit-company-email" title="Company Email Address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><TextInput id="resubmit-contact-person-name" title="Contact Person Name" value={contactName} onChange={(event) => setContactName(event.target.value)} required /><TextInput id="resubmit-contact-person-phone" title="Contact Person Phone Number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /><TextInput id="resubmit-address-line-1" title="Address Line 1" value={addressLine1} onChange={(event) => { setResubmitError(null); setAddressLine1(event.target.value); }} required autoComplete="address-line1" /><TextInput id="resubmit-address-line-2" title="Address Line 2" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} autoComplete="address-line2" /><TextInput id="resubmit-postcode" title="Postcode" value={postcode} onChange={(event) => { setResubmitError(null); setPostcode(event.target.value); }} required autoComplete="postal-code" /><TextInput id="resubmit-city" title="City" value={city} onChange={(event) => { setResubmitError(null); setCity(event.target.value); }} required autoComplete="address-level2" /><FilterSelect title="State" allLabel="Select state" value={state} options={[...malaysiaStates]} onChange={(value) => { setResubmitError(null); setState(value); }} required /><TextArea id="resubmit-additional-remarks" title="Additional Remarks" rows={1} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Add context for staff if needed" /></div>{resubmitError && <p className="case-field-error-message" role="alert">{resubmitError}</p>}</div>}
      {dialog === "accept_trial" && <div className="case-dialog-fields"><div className="case-form-grid"><DatePicker id="installment-start" title="Installments Start" value={installmentStart} placeholder="DD/MM/YYYY" onChange={setInstallmentStart} required /><FilterSelect title="Payment Term" allLabel="Select term" value={String(termMonths) as "10" | "20"} options={["10", "20"]} labels={{ "10": "10 months", "20": "20 months" }} onChange={(value) => setTermMonths(Number(value) as 10 | 20)} required /></div></div>}
      {dialog === "verify_savings" && <div className="case-dialog-fields"><div className="case-form-grid"><TextInput title="Verified Savings (kWh)" inputMode="decimal" value={savingsKwh} onChange={(event) => { setSavingsError(null); setSavingsKwh(event.target.value); }} aria-invalid={Boolean(savingsError)} aria-describedby={savingsError ? "verify-savings-error" : undefined} required /><MoneyInput title="Monthly Savings" inputMode="decimal" value={monthlySavings} onChange={(event) => { setSavingsError(null); setMonthlySavings(event.target.value); }} aria-invalid={Boolean(savingsError)} aria-describedby={savingsError ? "verify-savings-error" : undefined} required /></div>{savingsError && <p id="verify-savings-error" className="case-field-error-message" role="alert">{savingsError}</p>}</div>}
      {dialog === "record_installation" && <div className="case-dialog-fields"><div className="case-form-grid"><MoneyInput id="record-installation-payment" title="Payment Amount" inputMode="decimal" value={installationPaymentAmount} onChange={(event) => { setPaymentError(null); setInstallationPaymentAmount(event.target.value); }} aria-invalid={Boolean(paymentError)} aria-describedby={paymentError ? "record-installation-error" : undefined} required /><DatePicker id="record-installation-date" title="Installation Date" value={installationDate} placeholder="DD/MM/YYYY" onChange={(value) => { setPaymentError(null); setInstallationDate(value); }} required /></div>{paymentError && <p id="record-installation-error" className="case-field-error-message" role="alert">{paymentError}</p>}</div>}
    </ConfirmationDialog>
    <ConfirmationDialog open={recordPaymentOpen} title="Record Deposit" description="Enter the deposit amount and date. The deposit will be allocated automatically and confirmed immediately." confirmLabel="Confirm Deposit" confirmVariant="primary" loading={busy} confirmDisabled={Boolean(paymentError)} onCancel={closeRecordPayment} onConfirm={recordPayment}>
      <div className="case-dialog-fields"><MoneyInput id="record-payment-amount" title="Payment Amount" inputMode="decimal" value={paymentAmount} onChange={(event) => { setPaymentError(null); setPaymentAmount(event.target.value); }} aria-invalid={Boolean(paymentError)} aria-describedby={paymentError ? "record-payment-error" : undefined} required /><DatePicker id="record-payment-date" title="Payment Date" value={paymentDate} placeholder="DD/MM/YYYY" onChange={(value) => { setPaymentError(null); setPaymentDate(value); }} required />{paymentError && <p id="record-payment-error" className="case-field-error-message" role="alert">{paymentError}</p>}</div>
    </ConfirmationDialog>
    {proposalOpen && <ProposalForm caseDetail={caseDetail} user={user} onChanged={setCaseData} onClose={() => setProposalOpen(false)} />}
    {acceptanceOpen && <ProposalAcceptance caseDetail={caseDetail} user={user} onChanged={setCaseData} onClose={() => setAcceptanceOpen(false)} />}
  </div>;
}
