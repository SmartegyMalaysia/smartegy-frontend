/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { Button, ConfirmationDialog, Badge } from "./ui";
import { MoneyInput, ReadOnlyField, TextInput, TextArea } from "./form-controls";
import { DatePicker } from "./date-picker";
import { CaseDocumentUpload } from "./case-document-upload";
import { FilterSelect } from "./filter-select";
import { Toast, type ToastTone } from "./toast";
import { PopupModal } from "./popup-modal";
import { formatDate, formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { malaysiaStates } from "@/lib/malaysia";
import { casesRepository } from "@/lib/case-repository";
import { canEditCase, caseActionLabels, caseFlowStages, getCaseFlowStageIndex, type CaseActionKind } from "@/lib/case-workflow";
import type { CaseDetail, CaseDocument, CasePayment, CurrentUser, PaymentSchedule, ProposalEnergyReading } from "@/lib/types";
import { ProposalForm } from "./proposal-form";
import { ProposalAcceptance } from "./proposal-acceptance";

type CaseToast = { title: string; subtitle: string; tone: ToastTone };

function moneyInputValue(value: number | null | undefined) { return value == null ? "" : String(value / 100); }
const installationTimeOptions = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`);
const installationTimeLabels = Object.fromEntries(installationTimeOptions.map((value) => { const [hour, minute] = value.split(":").map(Number); const suffix = hour < 12 ? "AM" : "PM"; const displayHour = hour % 12 || 12; return [value, `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`]; }));
function uploadedDocumentLabel(type: string) { return type === "electricity_bill" ? "Electricity bill" : type === "signed_proposal" ? "Signed proposal" : "Supporting"; }
function uploadedDocumentTag(type: string) { return type === "electricity_bill" ? "document-tag-electricity" : type === "signed_proposal" ? "document-tag-signed" : "document-tag-supporting"; }
function generatedDocumentLabel(type: string) { return type === "quotation" ? "Proposal" : type === "invoice" ? "Invoice" : type === "receipt" ? "Receipt" : "Document"; }
function generatedDocumentTag(type: string) { return type === "quotation" ? "document-tag-proposal" : "document-tag-invoice"; }
function downloadLabel(fileName: string, mimeType?: string) {
  const extension = fileName.split(".").pop()?.toUpperCase();
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === "DOCX") return "Open DOCX";
  if (mimeType === "image/jpeg" || extension === "JPG" || extension === "JPEG") return "Open JPG";
  if (mimeType === "image/png" || extension === "PNG") return "Open PNG";
  if (mimeType === "image/webp" || extension === "WEBP") return "Open WEBP";
  return "Open File";
}

const savingsMonthOptions = Array.from({ length: 60 }, (_, index) => {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - index - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
});
const savingsMonthLabels = Object.fromEntries(savingsMonthOptions.map((value) => {
  const [year, month] = value.split("-").map(Number);
  return [value, new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)))];
}));
type SavingsReadingDraft = { month: string; bill: string; kwh: string };
const emptySavingsReadings = (): SavingsReadingDraft[] => Array.from({ length: 3 }, () => ({ month: "", bill: "", kwh: "" }));
function daysForMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return Number.isInteger(year) && Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12 ? new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() : null;
}
function savingsReadingDrafts(readings: ProposalEnergyReading[] | undefined): SavingsReadingDraft[] {
  if (!readings?.length) return emptySavingsReadings();
  return readings.slice(0, 3).map((reading) => ({ month: reading.month, bill: String(reading.billAmountSen / 100), kwh: String(reading.kwhUsed) })).concat(emptySavingsReadings()).slice(0, 3);
}
function buildSavingsReadings(drafts: SavingsReadingDraft[]): ProposalEnergyReading[] | null {
  if (drafts.length !== 3) return null;
  const parsed = drafts.map((reading, index) => {
    const days = daysForMonth(reading.month);
    const bill = Number(reading.bill);
    const kwh = Number(reading.kwh);
    return { sequence: index + 1, month: reading.month, tnbRate: bill / kwh, kwhUsed: kwh, billAmountSen: Math.round(bill * 100), operationDays: days ?? 0, dailyKwh: days ? Number((kwh / days).toFixed(3)) : undefined };
  });
  if (parsed.some((reading, index) => !reading.month || daysForMonth(reading.month) === null || !Number.isFinite(reading.billAmountSen) || reading.billAmountSen <= 0 || !Number.isFinite(reading.kwhUsed) || reading.kwhUsed <= 0 || !Number.isFinite(reading.tnbRate) || index !== drafts.findIndex((item) => item.month === reading.month))) return null;
  return parsed;
}
function paymentScheduleLabel(kind: PaymentSchedule["kind"]) { return kind === "deposit" ? "Downpayment" : kind === "post_installation" ? "Two-Month Balance" : titleCase(kind); }

type PaymentProofAccess = { fileName: string; mimeType: string; url: string };

function PaymentRecordsPanel({ payments, schedules, documents, role, selectedPaymentId, embedded = false, onViewProof, onVerifyPayment }: { payments: CasePayment[]; schedules: PaymentSchedule[]; documents: CaseDocument[]; role: CurrentUser["role"]; selectedPaymentId?: string | null; embedded?: boolean; onViewProof: (payment: CasePayment) => void; onVerifyPayment: (paymentId: string) => void }) {
  const records = [...payments].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  const content = <>
    <div className="case-payment-record-list">{records.length ? records.map((payment) => {
      const proof = payment.proofDocumentId ? documents.find((document) => document.id === payment.proofDocumentId) : null;
      const proofName = proof?.fileName ?? payment.proofFileName;
      return <article className={`case-payment-record ${selectedPaymentId === payment.id ? "case-payment-record-selected" : ""}`} key={payment.id}>
        <div className="case-payment-record-main"><div className="case-payment-record-heading"><strong>{formatMoney(payment.amountSen)}</strong><Badge status={payment.status} /></div><div className="case-payment-record-meta"><span>Paid on {formatDate(payment.paymentDate)}</span><span>Submitted {formatDateTime(payment.recordedAt)}</span>{payment.reference && <span>Reference: {payment.reference}</span>}</div>{payment.rejectionReason && <p className="case-payment-record-reason">Rejection reason: {payment.rejectionReason}</p>}{proofName && <button className="case-payment-proof-link" type="button" onClick={() => onViewProof(payment)}>View proof: {proofName}</button>}</div>
        <div className="case-payment-record-actions">{payment.status === "pending_verification" ? role === "agent" ? <span className="case-payment-pending-note">Pending staff verification</span> : <Button type="button" variant="secondary" size="sm" onClick={() => onVerifyPayment(payment.id)}>Review &amp; assign</Button> : payment.status === "verified" ? <span className="case-payment-pending-note">Assigned to schedule</span> : null}</div>
      </article>;
    }) : <p className="detail-empty">No payment records yet.</p>}</div>
  </>;
  return embedded ? <div className="case-payment-records-embedded">{content}</div> : <section className="panel case-payment-records-panel">{content}</section>;
}

function PaymentProofViewer({ access }: { access: PaymentProofAccess }) {
  const isImage = access.mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(access.fileName);
  const isPdf = access.mimeType === "application/pdf" || /\.pdf$/i.test(access.fileName);
  if (!/^(https?:\/\/|blob:)/i.test(access.url)) return <div className="registration-proof-unavailable"><p>This proof is available in the case documents list.</p><p>Open the original file from there to view it.</p></div>;
  return <div className="registration-proof-viewer">{isImage ? <img className="registration-proof-image" src={access.url} alt={`Payment proof: ${access.fileName}`} /> : isPdf ? <object className="registration-proof-pdf" data={access.url} type="application/pdf" aria-label={`Payment proof: ${access.fileName}`}><div className="registration-proof-unavailable"><p>Your browser cannot embed this PDF.</p></div></object> : <div className="registration-proof-unavailable"><p>This file type cannot be previewed here.</p></div>}<a className="button button-secondary" href={access.url} target="_blank" rel="noreferrer">Open original file</a></div>;
}

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
  const [depositProofError, setDepositProofError] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [installationDate, setInstallationDate] = useState(new Date().toISOString().slice(0, 10));
  const [installationTime, setInstallationTime] = useState("09:00");
  const [depositDue, setDepositDue] = useState(new Date().toISOString().slice(0, 10));
  const [postInstallationDue, setPostInstallationDue] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [savingsReadings, setSavingsReadings] = useState<SavingsReadingDraft[]>(() => savingsReadingDrafts(initialCase.verifiedSavings?.readings));
  const [savingsError, setSavingsError] = useState<string | null>(null);
  const [installmentStart, setInstallmentStart] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [termMonths, setTermMonths] = useState<10 | 20>(initialCase.proposal?.selectedTermMonths ?? initialCase.installmentTermMonths ?? 10);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [installationPaymentAmount, setInstallationPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentReference, setPaymentReference] = useState("");
  const [depositProof, setDepositProof] = useState<File | null>(null);
  const [paymentProofAccess, setPaymentProofAccess] = useState<PaymentProofAccess | null>(null);
  const [verificationPaymentId, setVerificationPaymentId] = useState<string | null>(null);
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
  const postInstallationPaid = Boolean(caseDetail.paymentSchedules?.some((schedule) => schedule.kind === "post_installation" && schedule.amountPaidSen >= schedule.amountDueSen));
  const latestStaffRemark = [...caseDetail.activity].reverse().find((event) => event.reason?.trim())?.reason ?? null;
  const pendingPayments = (caseDetail.payments ?? []).filter((payment) => payment.status === "pending_verification");
  const pendingPaymentAmountSen = pendingPayments.reduce((sum, payment) => sum + payment.amountSen, 0);
  const selectedPendingPayment = pendingPayments.find((payment) => payment.id === verificationPaymentId) ?? pendingPayments[0];
  const latestRejectedPayment = [...(caseDetail.payments ?? [])].reverse().find((payment) => payment.status === "rejected");
  const depositSchedule = (caseDetail.paymentSchedules ?? []).find((schedule) => schedule.kind === "deposit" && schedule.amountDueSen > schedule.amountPaidSen);
  const postInstallationSchedule = (caseDetail.paymentSchedules ?? []).find((schedule) => schedule.kind === "post_installation");
  const paymentScheduleKind = caseDetail.status === "post_installation_payment_pending_verification" || caseDetail.status === "awaiting_post_installation_payment" ? "post_installation" : caseDetail.status === "active_installments" ? "installment" : "deposit";
  const installmentSchedule = (caseDetail.paymentSchedules ?? []).find((schedule) => schedule.kind === "installment" && schedule.amountDueSen > schedule.amountPaidSen);
  const allocatableSchedules = (caseDetail.paymentSchedules ?? []).filter((schedule) => schedule.kind === paymentScheduleKind && schedule.amountDueSen > schedule.amountPaidSen);
  const depositBalanceSen = depositSchedule ? depositSchedule.amountDueSen - depositSchedule.amountPaidSen : 0;
  const postInstallationBalanceSen = postInstallationSchedule ? Math.max(0, postInstallationSchedule.amountDueSen - postInstallationSchedule.amountPaidSen) : 0;
  const currentPaymentBalanceSen = paymentScheduleKind === "deposit" ? depositBalanceSen : paymentScheduleKind === "post_installation" ? postInstallationBalanceSen : installmentSchedule ? installmentSchedule.amountDueSen - installmentSchedule.amountPaidSen : 0;
  const actions = caseActionLabels(caseDetail.status, user.role, Boolean(caseDetail.paymentSchedules?.length), depositPaid, pendingPayments.length > 0, postInstallationPaid, pendingPaymentAmountSen, currentPaymentBalanceSen);
  const currentStageIndex = getCaseFlowStageIndex(caseDetail.status);
  const canGenerateInvoice = user.role !== "agent" || user.agentId === caseDetail.agentId;
  const issuedInvoiceScheduleIds = new Set((caseDetail.financialDocuments ?? []).filter((document) => document.type === "invoice" && document.status === "issued" && document.sourceId).map((document) => document.sourceId));
  const activeInvoiceScheduleIds = new Set((caseDetail.paymentSchedules ?? []).filter((schedule) => !["waived", "cancelled"].includes(schedule.status) && schedule.amountDueSen > 0 && !issuedInvoiceScheduleIds.has(schedule.id)).map((schedule) => schedule.id));

  useEffect(() => { setDialog(null); setRecordPaymentOpen(false); setProposalOpen(false); setAcceptanceOpen(false); setEditing(false); setReason(""); setQuoteError(null); setPaymentError(null); setAllocationError(null); setVerificationPaymentId(null); setPaymentProofAccess(null); setSavingsError(null); setSavingsReadings(savingsReadingDrafts(initialCase.verifiedSavings?.readings)); setResubmitError(null); setDetailsError(null); setTermMonths(initialCase.proposal?.selectedTermMonths ?? initialCase.installmentTermMonths ?? 10); syncCaseFields(initialCase); }, [initialCase.id, initialCase.customer.displayName, initialCase.customer.contactName, initialCase.customer.email, initialCase.customer.phone, initialCase.service.siteAddress, initialCase.service.addressLine1, initialCase.service.addressLine2, initialCase.service.postcode, initialCase.service.city, initialCase.service.state, initialCase.service.notes, initialCase.proposal?.selectedTermMonths, initialCase.installmentTermMonths, initialCase.verifiedSavings?.verifiedAt]);

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
  function openDialog(action: CaseActionKind) {
    if (action === "pass_review") { setProposalOpen(true); return; }
    if (action === "submit_deposit" || action === "submit_post_installation_payment" || action === "submit_installment_payment") { openRecordPayment(); return; }
    if (action === "accept_proposal") { setAcceptanceOpen(true); return; }
    if (action === "verify_payment") { setAllocationError(null); setVerificationPaymentId(pendingPayments[0]?.id ?? null); setAllocations({}); setDialog(action); return; }
    if (action === "record_installation") { setPaymentError(null); setInstallationPaymentAmount(moneyInputValue(postInstallationBalanceSen)); }
    if (action === "verify_savings") setSavingsError(null);
    if (action === "resubmit") setResubmitError(null);
    setDialog(action);
  }
  function closeDialog() { setDialog(null); setRecordPaymentOpen(false); setReason(""); setQuoteError(null); setPaymentError(null); setAllocationError(null); setVerificationPaymentId(null); setSavingsError(null); setResubmitError(null); }
  function openRecordPayment() { setDialog(null); setPaymentError(null); setDepositProofError(null); setPaymentAmount(moneyInputValue(Math.max(0, currentPaymentBalanceSen - pendingPaymentAmountSen))); setPaymentDate(new Date().toISOString().slice(0, 10)); setPaymentReference(""); setDepositProof(null); setRecordPaymentOpen(true); }
  function closeRecordPayment() { setRecordPaymentOpen(false); setDialog(null); setPaymentError(null); setDepositProofError(null); }
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
        result = generated.ok ? await casesRepository.transition(user, caseDetail.id, "awaiting_deposit_submission") : generated;
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
      result = generated.ok ? await casesRepository.transition(user, caseDetail.id, "awaiting_deposit_submission") : generated;
    }
    else if (action === "submit_deposit" || action === "submit_post_installation_payment" || action === "submit_installment_payment") {
      const amount = Number(paymentAmount);
      if (!paymentAmount.trim() || !Number.isFinite(amount) || amount <= 0 || !paymentDate || !depositProof) { setPaymentError("Payment amount, payment date, and proof are required."); setBusy(false); return; }
      const balance = Math.max(0, (action === "submit_deposit" ? depositBalanceSen : action === "submit_post_installation_payment" ? postInstallationBalanceSen : installmentSchedule ? installmentSchedule.amountDueSen - installmentSchedule.amountPaidSen : 0) - pendingPaymentAmountSen);
      if (Math.round(amount * 100) > balance) { setPaymentError(`Payment amount cannot exceed the remaining balance of ${formatMoney(balance)}.`); setBusy(false); return; }
      const input = { amountSen: Math.round(amount * 100), paymentDate, reference: paymentReference, proof: { file: depositProof, fileName: depositProof.name, mimeType: depositProof.type, sizeBytes: depositProof.size } };
      result = action === "submit_deposit" ? await casesRepository.submitDeposit(user, caseDetail.id, input) : action === "submit_post_installation_payment" ? await casesRepository.submitPostInstallationPayment(user, caseDetail.id, input) : await casesRepository.submitInstallmentPayment(user, caseDetail.id, input);
    } else if (action === "reject_payment") {
      if (!selectedPendingPayment || !reason.trim()) { setAllocationError("A payment and rejection reason are required."); setBusy(false); return; }
      result = await casesRepository.rejectPayment(user, selectedPendingPayment.id, reason);
    } else if (action === "verify_payment") {
      if (!selectedPendingPayment) { setAllocationError("No pending payment is available for verification."); setBusy(false); return; }
      const parsed = allocatableSchedules.map((schedule) => ({ scheduleId: schedule.id, amountSen: Math.round(Number(allocations[schedule.id] ?? 0) * 100) })).filter((item) => item.amountSen > 0);
      if (!parsed.length || parsed.reduce((sum, item) => sum + item.amountSen, 0) !== selectedPendingPayment.amountSen) { setAllocationError("Allocations must equal the pending payment amount."); setBusy(false); return; }
      result = await casesRepository.verifyPayment(user, { paymentId: selectedPendingPayment.id, allocations: parsed });
    } else if (action === "propose_installation") {
      if (!installationDate) { setPaymentError("An installation date is required."); setBusy(false); return; }
      if (!installationTime) { setPaymentError("An installation time is required."); setBusy(false); return; }
      result = await casesRepository.proposeInstallationDate(user, caseDetail.id, installationDate, installationTime);
    } else if (action === "confirm_installation") {
      result = await casesRepository.confirmInstallationDate(user, caseDetail.id);
    } else if (action === "request_reschedule") {
      result = await casesRepository.requestInstallationReschedule(user, caseDetail.id, reason);
    } else if (action === "record_installation") {
      const confirmedInstallationDate = caseDetail.installationProposedDate;
      const confirmedInstallationTime = caseDetail.installationProposedTime?.slice(0, 5);
      if (!confirmedInstallationDate || !confirmedInstallationTime) { setPaymentError("A confirmed installation date and time are required."); setBusy(false); return; }
      const completeInstallation = async () => {
        if (caseDetail.status === "awaiting_installation_scheduling") {
          const scheduled = await casesRepository.transition(user, caseDetail.id, "installation_scheduled");
          return scheduled.ok ? casesRepository.recordInstallation(user, caseDetail.id, confirmedInstallationDate, confirmedInstallationTime) : scheduled;
        }
        return casesRepository.recordInstallation(user, caseDetail.id, confirmedInstallationDate, confirmedInstallationTime);
      };
      result = await completeInstallation();
    }
    else if (action === "verify_savings") {
      const readings = buildSavingsReadings(savingsReadings);
      if (!readings) { setSavingsError("Enter three unique month-and-year readings with a valid bill amount and kWh usage."); setBusy(false); return; }
      const verified = await casesRepository.verifySavings(user, caseDetail.id, { readings });
      result = verified;
    }
    else if (action === "accept_trial") result = await casesRepository.acceptTrial(user, caseDetail.id, { installmentStart, termMonths });
    else { setBusy(false); return; }
    if (!result.ok && action === "verify_payment") setAllocationError(result.error.message);
    if (!result.ok && ["submit_deposit", "submit_post_installation_payment", "submit_installment_payment", "propose_installation", "record_installation"].includes(action)) setPaymentError(result.error.message);
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
    const balance = Math.max(0, currentPaymentBalanceSen - pendingPaymentAmountSen);
    if (Math.round(amount * 100) > balance) { setPaymentError(`Payment amount cannot exceed the remaining balance of ${formatMoney(balance)}.`); return; }
    setBusy(true);
    setToast(null);
    if (!depositProof) { setDepositProofError("Deposit proof is required."); setBusy(false); return; }
    const input = { amountSen: Math.round(amount * 100), paymentDate, reference: paymentReference, proof: { file: depositProof, fileName: depositProof.name, mimeType: depositProof.type, sizeBytes: depositProof.size } };
    const result = paymentScheduleKind === "deposit" ? await casesRepository.submitDeposit(user, caseDetail.id, input) : paymentScheduleKind === "post_installation" ? await casesRepository.submitPostInstallationPayment(user, caseDetail.id, input) : await casesRepository.submitInstallmentPayment(user, caseDetail.id, input);
    if (result.ok) { closeRecordPayment(); apply(result); }
    else setPaymentError(result.error.message);
    setBusy(false);
  }
  async function downloadDocument(documentId: string) {
    const result = await casesRepository.getDocumentUrl(user, caseDetail.id, documentId);
    if (!result.ok) { showError(result.error.message, "Document Access Failed"); return; }
    const opened = window.open(result.data, "_blank", "noopener,noreferrer");
    if (!opened) showError("Allow pop-ups to open the DOCX in a new tab.", "Document Access Failed");
  }
  async function viewPaymentProof(payment: CasePayment) {
    if (!payment.proofDocumentId) { showError("No payment proof is attached to this record.", "Payment Proof Unavailable"); return; }
    const document = caseDetail.documents.find((item) => item.id === payment.proofDocumentId);
    if (!document) { showError("The payment proof file could not be found in the case documents.", "Payment Proof Unavailable"); return; }
    const result = await casesRepository.getDocumentUrl(user, caseDetail.id, document.id);
    if (!result.ok) { showError(result.error.message, "Payment Proof Unavailable"); return; }
    setPaymentProofAccess({ fileName: document.fileName, mimeType: document.mimeType, url: result.data });
  }
  async function getTimelineDocumentIds(document: { id: string; documentIds: string[]; regenerateType: "quotation" | "proforma" | null; sourceId?: string }) {
    let documentIds = document.documentIds;
    if (document.regenerateType && documentIds.length === 0) {
      const generated = await casesRepository.generateFinancialDocument(user, caseDetail.id, document.regenerateType, document.regenerateType === "proforma" ? document.sourceId : undefined);
      if (!generated.ok) { showError(generated.error.message, "Document Access Failed"); return null; }
      const refreshed = await casesRepository.getById(user, caseDetail.id);
      if (!refreshed.ok) { showError(refreshed.error.message, "Document Access Failed"); return null; }
      setCaseData(refreshed.data);
      const refreshedDocument = refreshed.data.financialDocuments?.find((item) => item.id === document.id);
      documentIds = [refreshedDocument?.caseDocumentId].filter((id): id is string => Boolean(id));
    }
    if (!documentIds.length) { showError("No DOCX file is attached to this document.", "Document Access Failed"); return null; }
    return documentIds;
  }
  async function downloadTimelineDocument(document: { id: string; documentIds: string[]; regenerateType: "quotation" | "proforma" | null; sourceId?: string }) {
    const documentIds = await getTimelineDocumentIds(document);
    if (documentIds?.[0]) await downloadDocument(documentIds[0]);
  }
  async function generateDocument(type: "proforma", paymentScheduleId?: string) {
    setBusy(true); setToast(null);
    const result = await casesRepository.generateFinancialDocument(user, caseDetail.id, type, paymentScheduleId);
    if (result.ok) { const refreshed = await casesRepository.getById(user, caseDetail.id); if (refreshed.ok) setCaseData(refreshed.data); setToast({ title: "Document Generated", subtitle: `${result.data.documentNumber} is ready in the generated documents list.`, tone: "success" }); }
    else showError(result.error.message, "Document Generation Failed");
    setBusy(false);
  }
  const documentRows = [
    ...caseDetail.documents.filter((document) => document.type !== "signed_proposal" || document.id === caseDetail.proposal?.signedDocumentId).map((document) => ({ kind: "uploaded" as const, id: document.id, date: document.uploadedAt, label: uploadedDocumentLabel(document.type), tag: uploadedDocumentTag(document.type), name: document.fileName, detail: `${Math.ceil(document.sizeBytes / 1024)} KB`, downloadLabel: downloadLabel(document.fileName, document.mimeType), documentIds: [document.id], regenerateType: null })),
    ...(caseDetail.financialDocuments ?? []).map((document) => ({ kind: "generated" as const, id: document.id, date: document.issuedAt ?? document.createdAt, label: generatedDocumentLabel(document.type), tag: generatedDocumentTag(document.type), name: document.documentNumber, detail: `${formatMoney(document.amountSen)} - ${titleCase(document.status)}`, downloadLabel: document.type === "receipt" ? "Open Document" : "Open DOCX", documentIds: [document.caseDocumentId, document.pdfCaseDocumentId].filter((id): id is string => Boolean(id)), regenerateType: document.type === "quotation" ? "quotation" as const : document.type === "invoice" ? "proforma" as const : null, sourceId: document.sourceId })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return <div className="case-workspace">
    <section className="case-stage-tracker panel" aria-label="Case progress">
      <div className="panel-header"><div><h2>Case Progress</h2><p>Stage {currentStageIndex + 1} of {caseFlowStages.length}: {caseFlowStages[currentStageIndex]}</p></div><Badge status={caseDetail.status} /></div>
      <ol className="case-stage-list">
        {caseFlowStages.map((stage, index) => <li className={`case-stage-item ${index < currentStageIndex ? "case-stage-complete" : index === currentStageIndex ? "case-stage-current" : "case-stage-upcoming"}`} key={stage}>
          <span className="case-stage-number" aria-hidden="true">{index < currentStageIndex ? "✓" : index + 1}</span>
          <span className="case-stage-label">{stage}</span>
        </li>)}
      </ol>
    </section>
    <div className="case-action-panel panel">
      <div className="panel-header"><div><h2>Next Actions</h2><p>Available actions depend on this case’s current stage and your role. Required details, payments, and approvals must be completed before the case can advance.</p></div></div>

      <div className="case-action-list">{actions.map((action) => <Button key={action.kind} type="button" variant={action.variant} disabled={busy} onClick={() => action.requiresReason || action.kind === "pass_review" || action.kind === "accept_proposal" || action.kind === "verify_payment" || action.kind === "submit_deposit" || action.kind === "submit_post_installation_payment" || action.kind === "submit_installment_payment" || action.kind === "propose_installation" || action.kind === "confirm_installation" || action.kind === "record_installation" || action.kind === "verify_savings" || action.kind === "accept_trial" || action.kind === "delete_case" || action.kind === "resubmit" ? openDialog(action.kind) : run(action.kind)}>{action.label}</Button>)}</div>
    </div>
    <div className="case-detail-grid">
      <section className="panel case-form-panel"><div className="panel-header"><div><h2>Customer and Service</h2><p>Submitted {formatDate(caseDetail.submittedAt)} by {caseDetail.agentName}</p></div>{canEditDetails && <Button type="button" variant="secondary" size="sm" onClick={() => { setDetailsError(null); setEditing(!editing); }}>{editing ? "Cancel Edit" : "Edit Details"}</Button>}</div>{editing ? <div className="case-form-body"><div className="case-form-grid"><TextInput id="edit-company-name" title="Company Name" value={customerName} onChange={(event) => { setDetailsError(null); setCustomerName(event.target.value); }} required /><TextInput id="edit-company-email" title="Company Email Address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><TextInput id="edit-contact-person-name" title="Contact Person Name" value={contactName} onChange={(event) => setContactName(event.target.value)} required /><TextInput id="edit-contact-person-phone" title="Contact Person Phone Number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /><TextInput id="edit-address-line-1" title="Address Line 1" value={addressLine1} onChange={(event) => { setDetailsError(null); setAddressLine1(event.target.value); }} required autoComplete="address-line1" /><TextInput id="edit-address-line-2" title="Address Line 2" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} autoComplete="address-line2" /><TextInput id="edit-postcode" title="Postcode" value={postcode} onChange={(event) => { setDetailsError(null); setPostcode(event.target.value); }} required autoComplete="postal-code" /><TextInput id="edit-city" title="City" value={city} onChange={(event) => { setDetailsError(null); setCity(event.target.value); }} required autoComplete="address-level2" /><FilterSelect title="State" allLabel="Select state" value={state} options={[...malaysiaStates]} onChange={(value) => { setDetailsError(null); setState(value); }} required /><TextArea id="edit-additional-remarks" title="Additional Remarks" rows={1} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Add context for staff if needed" /></div>{detailsError && <p className="case-field-error-message" role="alert">{detailsError}</p>}<Button type="button" onClick={saveDetails} disabled={busy}>Save Details</Button></div> : <dl className="case-detail-list"><div><dt>Company Name</dt><dd>{caseDetail.customer.displayName}</dd></div><div><dt>Contact</dt><dd>{caseDetail.customer.contactName ?? "Not provided"}</dd></div><div><dt>Email</dt><dd>{caseDetail.customer.email ?? "Not provided"}</dd></div><div><dt>Phone</dt><dd>{caseDetail.customer.phone ?? "Not provided"}</dd></div>{user.role !== "agent" && <div><dt>Type of Business</dt><dd>{caseDetail.customer.businessType === "Other" ? caseDetail.customer.businessTypeOther || "Other" : caseDetail.customer.businessType || "Not provided"}</dd></div>}<div><dt>Service Address</dt><dd>{caseDetail.service.siteAddress || "Not provided"}</dd></div><div><dt>Remarks</dt><dd>{caseDetail.service.notes || "No remarks provided."}</dd></div></dl>}</section>
      <section className="panel case-form-panel"><div className="panel-header"><div><h2>Documents</h2><p>Uploads and generated documents in chronological order.</p></div></div><div className="case-documents-timeline">{documentRows.length ? documentRows.map((document) => <div className="case-document-timeline-row" key={`${document.kind}-${document.id}`}><span className="case-document-timeline-dot" aria-hidden="true" /><div className={`case-document-timeline-content ${document.tag}`}><div className="case-document-timeline-meta"><span className={`document-tag ${document.tag}`}>{document.label}</span><time dateTime={document.date}>{formatDateTime(document.date)}</time></div><div className="case-document-timeline-file"><div><strong>{document.name}</strong><span>{document.detail}</span></div>{(document.documentIds.length > 0 || document.regenerateType) && <Button type="button" variant="ghost" size="sm" onClick={() => downloadTimelineDocument(document)}>{document.downloadLabel}</Button>}</div></div></div>) : <p className="detail-empty">No documents yet.</p>}</div></section>
    </div>
    <div className="case-detail-grid">
      <section className="panel case-form-panel"><div className="panel-header"><div><h2>Quote, Savings and Installation</h2><p>Operational values used by the workflow.</p></div></div><dl className="case-detail-list"><div><dt>Sale amount</dt><dd>{formatMoney(caseDetail.quote?.saleAmountSen ?? caseDetail.saleAmountSen)}</dd></div><div><dt>Quoted monthly savings</dt><dd>{caseDetail.quote?.quotedMonthlySavingsSen == null ? "Not provided" : formatMoney(caseDetail.quote.quotedMonthlySavingsSen)}</dd></div>{user.role !== "agent" && <div><dt>Type of business</dt><dd>{caseDetail.customer.businessType === "Other" ? caseDetail.customer.businessTypeOther ?? "Other" : caseDetail.customer.businessType ?? "Not provided"}</dd></div>}<div><dt>Proposed installation</dt><dd>{caseDetail.installationProposedDate ? `${caseDetail.installationProposedDate}${caseDetail.installationProposedTime ? ` at ${caseDetail.installationProposedTime.slice(0, 5)}` : ""}` : "Not proposed"}</dd></div><div><dt>Completed installation</dt><dd>{caseDetail.installationDate ? `${caseDetail.installationDate}${caseDetail.installationTime ? ` at ${caseDetail.installationTime.slice(0, 5)}` : ""}` : "Not recorded"}</dd></div><div><dt>Installment term</dt><dd>{caseDetail.installmentTermMonths ? `${caseDetail.installmentTermMonths} months` : "Not started"}</dd></div></dl></section>
      <section className="panel case-form-panel"><div className="panel-header"><div><h2>Savings</h2><p>Recorded post-installation savings values.</p></div></div>{caseDetail.verifiedSavings ? <><dl className="case-detail-list"><div><dt>Average kWh</dt><dd>{caseDetail.verifiedSavings.avgKwh == null ? "Not recorded" : `${caseDetail.verifiedSavings.avgKwh} kWh`}</dd></div><div><dt>Average bill</dt><dd>{caseDetail.verifiedSavings.avgBillSen == null ? "Not recorded" : formatMoney(caseDetail.verifiedSavings.avgBillSen)}</dd></div><div><dt>Average TNB rate</dt><dd>{caseDetail.verifiedSavings.avgRate == null ? "Not recorded" : caseDetail.verifiedSavings.avgRate.toFixed(6)}</dd></div><div><dt>Savings</dt><dd>{caseDetail.verifiedSavings.savingsKwh == null ? "Not recorded" : `${caseDetail.verifiedSavings.savingsKwh} kWh`}</dd></div><div><dt>Monthly savings</dt><dd>{caseDetail.verifiedSavings.monthlySavingsSen == null ? "Not recorded" : formatMoney(caseDetail.verifiedSavings.monthlySavingsSen)}</dd></div><div><dt>Recorded</dt><dd>{caseDetail.verifiedSavings.verifiedAt ? formatDateTime(caseDetail.verifiedSavings.verifiedAt) : "Not recorded"}</dd></div></dl><div className="case-savings-readings">{caseDetail.verifiedSavings.readings.length ? <div className="case-savings-reading-list">{caseDetail.verifiedSavings.readings.map((reading) => <div className="case-savings-reading-row" key={reading.sequence}><span>{savingsMonthLabels[reading.month] ?? reading.month}</span><span>{formatMoney(reading.billAmountSen)}</span><span>{reading.kwhUsed} kWh</span><span>{reading.tnbRate.toFixed(6)} rate</span><span>{reading.operationDays} days</span></div>)}</div> : <p className="detail-empty">No readings recorded.</p>}</div></> : <p className="detail-empty case-card-empty">No savings verification recorded.</p>}</section>
      <section className="panel case-form-panel"><div className="panel-header"><div><h2>Payment Schedule</h2><p>Initial obligations and installments</p></div></div><div className="case-schedule-list">{caseDetail.paymentSchedules?.length ? caseDetail.paymentSchedules.map((schedule) => <div className="case-schedule-row" key={schedule.id}><span className="case-schedule-main">{schedule.sequence}. {paymentScheduleLabel(schedule.kind)}<small>{schedule.dueDate}</small></span><span className="case-schedule-amount">{formatMoney(schedule.amountPaidSen)} / {formatMoney(schedule.amountDueSen)} <Badge status={schedule.status === "paid" ? "verified" : "pending_verification"} />{canGenerateInvoice && activeInvoiceScheduleIds.has(schedule.id) && <Button type="button" variant="ghost" size="sm" onClick={() => generateDocument("proforma", schedule.id)} disabled={busy}>Generate Invoice</Button>}</span></div>) : <p className="detail-empty">No payment schedule generated.</p>}</div></section>
    </div>
    <section className="panel case-form-panel"><div className="panel-header"><div><h2>Status Timeline</h2><p>Full case audit history</p></div></div><div className="case-detail-activity">{caseDetail.activity.map((event) => <div key={event.id}><span className="case-activity-dot" aria-hidden="true" /><div className="case-activity-content"><strong>{event.summary}</strong><span className="case-activity-meta"><span>{event.actorDisplayName}</span><time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time></span></div></div>)}</div></section>
    {toast && <Toast title={toast.title} subtitle={toast.subtitle} tone={toast.tone} onDismiss={() => setToast(null)} />}
    <ConfirmationDialog open={Boolean(dialog)} size={dialog === "resubmit" || dialog === "verify_payment" ? "lg" : "md"} title={dialog === "resubmit" ? "Update Case Details" : dialog === "reject_payment" ? "Reject Payment?" : dialog === "request_reschedule" ? "Request Installation Reschedule" : dialog === "delete_case" ? "Delete This Case?" : dialog === "cancel" ? "Cancel This Case?" : dialog === "request_changes" ? "Request Changes?" : dialog === "verify_payment" ? "Verify Payment" : dialog === "propose_installation" ? "Set Installation Date and Time" : dialog === "confirm_installation" ? "Confirm Installation Date?" : dialog === "record_installation" ? "Confirm Installation Completed?" : dialog === "verify_savings" ? "Record Savings" : dialog === "accept_trial" ? "Start Recurring Balance" : "Start Quotation Details"} description={dialog === "reject_payment" ? "Explain why the payment was rejected. The agent can then upload a new proof." : dialog === "request_reschedule" ? "Tell staff the client’s preferred date or time. Staff will enter the replacement schedule." : dialog === "verify_payment" ? "Review and allocate the pending payment before marking it as valid." : dialog === "propose_installation" ? "Set the installation date and time for the agent to confirm with the client." : dialog === "record_installation" ? "Confirm that installation was completed at the accepted date and time." : dialog === "verify_savings" ? "Record three post-installation readings for this case. No staff approval is required." : dialog === "accept_trial" ? "Choose the first recurring instalment date and payment term before starting the schedule." : ""} confirmLabel={dialog === "reject_payment" ? "Reject Payment" : dialog === "request_reschedule" ? "Send Suggestion" : dialog === "verify_payment" ? "Verify Payment" : dialog === "propose_installation" ? "Propose Date and Time" : dialog === "record_installation" ? "Confirm Installation" : dialog === "verify_savings" ? "Record Savings" : dialog === "accept_trial" ? "Start Recurring Balance" : "Confirm"} confirmVariant={dialog === "delete_case" || dialog === "cancel" || dialog === "reject_payment" ? "danger" : "primary"} loading={busy} confirmDisabled={(dialog === "verify_payment" && Boolean(allocationError)) || (dialog === "propose_installation" && (!installationDate || !installationTime)) || (dialog === "record_installation" && (!caseDetail.installationProposedDate || !caseDetail.installationProposedTime))} reason={reason} reasonRequired={dialog === "cancel" || dialog === "request_changes" || dialog === "request_reschedule" || dialog === "reject_payment"} onReasonChange={dialog === "cancel" || dialog === "request_changes" || dialog === "request_reschedule" || dialog === "reject_payment" ? setReason : undefined} onCancel={closeDialog} onConfirm={() => dialog && run(dialog)} footer={dialog === "confirm_installation" ? <div className="dialog-actions"><Button variant="secondary" onClick={closeDialog} disabled={busy}>Cancel</Button><Button variant="danger" onClick={() => { setReason(""); setDialog("request_reschedule"); }} disabled={busy}>Request Reschedule</Button><Button variant="primary" onClick={() => run("confirm_installation")} disabled={busy}>Confirm</Button></div> : dialog === "verify_payment" ? <div className="dialog-actions"><Button variant="secondary" onClick={closeDialog} disabled={busy}>Cancel</Button>{user.role !== "agent" && <Button variant="danger" onClick={() => { setReason(""); setDialog("reject_payment"); }} disabled={busy}>Reject Payment</Button>}<Button variant="primary" onClick={() => run("verify_payment")} disabled={busy || Boolean(allocationError)}>Verify Payment</Button></div> : undefined}>
      {dialog === "verify_payment" && <div className="case-dialog-fields"><PaymentRecordsPanel payments={caseDetail.payments ?? []} schedules={caseDetail.paymentSchedules ?? []} documents={caseDetail.documents} role={user.role} selectedPaymentId={verificationPaymentId} embedded onViewProof={viewPaymentProof} onVerifyPayment={(paymentId) => { setVerificationPaymentId(paymentId); setAllocationError(null); setAllocations({}); }} /><div className="case-allocation-list">{allocatableSchedules.length ? allocatableSchedules.map((schedule) => <div className="case-field" key={schedule.id}><label htmlFor={`allocation-${schedule.id}`}>Schedule {schedule.sequence} · {titleCase(schedule.kind)}</label><span className="case-allocation-balance">Remaining Balance: {formatMoney(schedule.amountDueSen - schedule.amountPaidSen)}</span><MoneyInput id={`allocation-${schedule.id}`} inputMode="decimal" value={allocations[schedule.id] ?? ""} onChange={(event) => { setAllocationError(null); setAllocations((current) => ({ ...current, [schedule.id]: event.target.value })); }} aria-invalid={Boolean(allocationError)} aria-describedby={allocationError ? "payment-allocation-error" : undefined} /></div>) : <p className="detail-empty">No outstanding payment schedules are available.</p>}</div>{allocationError && <p id="payment-allocation-error" className="case-field-error-message" role="alert">{allocationError}</p>}</div>}
      {dialog === "propose_installation" && <div className="case-dialog-fields"><div className="case-form-grid"><DatePicker id="proposed-installation-date" title="Proposed Installation Date" value={installationDate} placeholder="DD/MM/YYYY" onChange={(value) => { setPaymentError(null); setInstallationDate(value); }} required /><FilterSelect title="Proposed Installation Time" allLabel="Select time" value={installationTime} options={installationTimeOptions} labels={installationTimeLabels} onChange={setInstallationTime} required /></div>{paymentError && <p className="case-field-error-message" role="alert">{paymentError}</p>}</div>}
      {dialog === "confirm_installation" && <div className="case-dialog-fields"><div className="case-form-grid"><DatePicker id="confirmed-installation-date" title="Proposed Installation Date" value={caseDetail.installationProposedDate ?? ""} placeholder="DD/MM/YYYY" onChange={() => undefined} disabled /><FilterSelect title="Proposed Installation Time" allLabel="Select time" value={caseDetail.installationProposedTime?.slice(0, 5) ?? ""} options={installationTimeOptions} labels={installationTimeLabels} onChange={() => undefined} disabled /></div></div>}
      {dialog === "pass_review" && <div className="case-dialog-fields"><div className="case-form-grid"><MoneyInput id="pass-review-sale-amount" title="Sale Amount" inputMode="decimal" value={saleAmount} onChange={(event) => { setQuoteError(null); setSaleAmount(event.target.value); }} aria-invalid={Boolean(quoteError)} aria-describedby={quoteError ? "pass-review-quote-error" : undefined} required /><MoneyInput id="pass-review-monthly-savings" title="Quoted Monthly Savings" inputMode="decimal" value={quotedMonthlySavings} onChange={(event) => { setQuoteError(null); setQuotedMonthlySavings(event.target.value); }} aria-invalid={Boolean(quoteError)} aria-describedby={quoteError ? "pass-review-quote-error" : undefined} required /><DatePicker id="deposit-due" title="Deposit Due" value={depositDue} placeholder="DD/MM/YYYY" onChange={(value) => { setQuoteError(null); setDepositDue(value); }} required /><DatePicker id="post-installation-due" title="Post-Installation Due" value={postInstallationDue} placeholder="DD/MM/YYYY" onChange={(value) => { setQuoteError(null); setPostInstallationDue(value); }} required /></div>{quoteError && <p id="pass-review-quote-error" className="case-field-error-message" role="alert">{quoteError}</p>}</div>}
      {dialog === "resubmit" && <div className="case-dialog-fields">{latestStaffRemark ? <ReadOnlyField id="staff-review-remark" title="Staff Remarks" value={latestStaffRemark} multiline /> : <p className="detail-empty">No staff remarks were provided.</p>}<div className="case-form-grid"><TextInput id="resubmit-company-name" title="Company Name" value={customerName} onChange={(event) => { setResubmitError(null); setCustomerName(event.target.value); }} required /><TextInput id="resubmit-company-email" title="Company Email Address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><TextInput id="resubmit-contact-person-name" title="Contact Person Name" value={contactName} onChange={(event) => setContactName(event.target.value)} required /><TextInput id="resubmit-contact-person-phone" title="Contact Person Phone Number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /><TextInput id="resubmit-address-line-1" title="Address Line 1" value={addressLine1} onChange={(event) => { setResubmitError(null); setAddressLine1(event.target.value); }} required autoComplete="address-line1" /><TextInput id="resubmit-address-line-2" title="Address Line 2" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} autoComplete="address-line2" /><TextInput id="resubmit-postcode" title="Postcode" value={postcode} onChange={(event) => { setResubmitError(null); setPostcode(event.target.value); }} required autoComplete="postal-code" /><TextInput id="resubmit-city" title="City" value={city} onChange={(event) => { setResubmitError(null); setCity(event.target.value); }} required autoComplete="address-level2" /><FilterSelect title="State" allLabel="Select state" value={state} options={[...malaysiaStates]} onChange={(value) => { setResubmitError(null); setState(value); }} required /><TextArea id="resubmit-additional-remarks" title="Additional Remarks" rows={1} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Add context for staff if needed" /></div>{resubmitError && <p className="case-field-error-message" role="alert">{resubmitError}</p>}</div>}
      {dialog === "accept_trial" && <div className="case-dialog-fields"><div className="case-form-grid"><DatePicker id="installment-start" title="Installments Start" value={installmentStart} placeholder="DD/MM/YYYY" onChange={setInstallmentStart} required /><FilterSelect title="Payment Term" allLabel="Select term" value={String(termMonths) as "10" | "20"} options={["10", "20"]} labels={{ "10": "10 months", "20": "20 months" }} onChange={(value) => setTermMonths(Number(value) as 10 | 20)} required /></div></div>}
      {dialog === "verify_savings" && <div className="case-dialog-fields"><p className="case-inline-note">Enter exactly three completed historical month readings. Days are filled from the selected calendar month and the system records the returned averages and savings.</p><div className="case-savings-entry-list">{savingsReadings.map((reading, index) => { const selectedByOtherRow = new Set(savingsReadings.filter((_, readingIndex) => readingIndex !== index).map((item) => item.month).filter(Boolean)); const options = savingsMonthOptions.filter((option) => option === reading.month || !selectedByOtherRow.has(option)); const days = daysForMonth(reading.month); const bill = Number(reading.bill); const kwh = Number(reading.kwh); const rate = bill > 0 && kwh > 0 ? (bill / kwh).toFixed(6) : "—"; return <div className="case-savings-entry-row" key={index}><span className="case-savings-entry-number">{index + 1}</span><FilterSelect title="Month and Year" allLabel="Select month" value={reading.month} options={["", ...options]} labels={{ "": "Select month", ...savingsMonthLabels }} onChange={(value) => { setSavingsError(null); setSavingsReadings((current) => current.map((item, readingIndex) => readingIndex === index ? { ...item, month: value } : item)); }} required /><MoneyInput title="TNB Bill" inputMode="decimal" value={reading.bill} onChange={(event) => { setSavingsError(null); setSavingsReadings((current) => current.map((item, readingIndex) => readingIndex === index ? { ...item, bill: event.target.value } : item)); }} aria-invalid={Boolean(savingsError)} aria-describedby={savingsError ? "verify-savings-error" : undefined} required /><TextInput title="kWh Used" inputMode="decimal" value={reading.kwh} onChange={(event) => { setSavingsError(null); setSavingsReadings((current) => current.map((item, readingIndex) => readingIndex === index ? { ...item, kwh: event.target.value } : item)); }} aria-invalid={Boolean(savingsError)} aria-describedby={savingsError ? "verify-savings-error" : undefined} required /><ReadOnlyField id={`savings-rate-${index}`} title="TNB Rate" value={rate} /><ReadOnlyField id={`savings-days-${index}`} title="Days" value={days == null ? "Select month" : String(days)} /></div>; })}</div>{savingsError && <p id="verify-savings-error" className="case-field-error-message" role="alert">{savingsError}</p>}</div>}
      {dialog === "record_installation" && <div className="case-dialog-fields"><div className="case-form-grid"><DatePicker id="record-installation-date" title="Accepted Installation Date" value={caseDetail.installationProposedDate ?? ""} placeholder="DD/MM/YYYY" onChange={() => undefined} disabled /><FilterSelect title="Accepted Installation Time" allLabel="Select time" value={caseDetail.installationProposedTime?.slice(0, 5) ?? ""} options={installationTimeOptions} labels={installationTimeLabels} onChange={() => undefined} disabled /></div>{paymentError && <p id="record-installation-error" className="case-field-error-message" role="alert">{paymentError}</p>}</div>}
    </ConfirmationDialog>
    <ConfirmationDialog open={recordPaymentOpen} title={paymentScheduleKind === "deposit" ? "Record Downpayment" : paymentScheduleKind === "post_installation" ? "Record Post-Installation Payment" : "Record Installment Payment"} description="Submit the payment amount, payment date, reference, and proof for verification." confirmLabel="Submit Payment" confirmVariant="primary" loading={busy} confirmDisabled={Boolean(paymentError)} onCancel={closeRecordPayment} onConfirm={recordPayment}>
      <div className="case-dialog-fields">{latestRejectedPayment?.rejectionReason && <ReadOnlyField id="payment-rejection-reason" title="Staff Rejection Reason" value={latestRejectedPayment.rejectionReason} multiline />}<div className="case-form-grid"><MoneyInput id="record-payment-amount" title="Payment Amount" inputMode="decimal" value={paymentAmount} onChange={(event) => { setPaymentError(null); setPaymentAmount(event.target.value); }} aria-invalid={Boolean(paymentError)} aria-describedby={paymentError ? "record-payment-error" : undefined} required /><DatePicker id="record-payment-date" title="Payment Date" value={paymentDate} placeholder="DD/MM/YYYY" onChange={(value) => { setPaymentError(null); setPaymentDate(value); }} required /><TextInput id="record-payment-reference" title="Payment Reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} fieldClassName="case-field-full" /></div><div className="case-field"><label htmlFor="record-payment-proof">Payment Proof <span className="required-mark">*</span></label><CaseDocumentUpload id="record-payment-proof" type="payment_proof" files={depositProof ? [depositProof] : []} error={depositProofError ?? undefined} showReady={!paymentError} onFilesChange={(files) => { setDepositProofError(null); setDepositProof(files[0] ?? null); }} onError={setDepositProofError} /></div>{paymentError && <p id="record-payment-error" className="case-field-error-message" role="alert">{paymentError}</p>}</div>
    </ConfirmationDialog>
    <PopupModal open={Boolean(paymentProofAccess)} title={paymentProofAccess?.fileName ?? "Payment proof"} description="Secure payment proof preview" size="lg" onClose={() => setPaymentProofAccess(null)} footer={<Button type="button" variant="secondary" onClick={() => setPaymentProofAccess(null)}>Close</Button>}>{paymentProofAccess && <PaymentProofViewer access={paymentProofAccess} />}</PopupModal>
    {proposalOpen && <ProposalForm caseDetail={caseDetail} user={user} onChanged={setCaseData} onClose={() => setProposalOpen(false)} />}
    {acceptanceOpen && <ProposalAcceptance caseDetail={caseDetail} user={user} onChanged={setCaseData} onClose={() => setAcceptanceOpen(false)} />}
  </div>;
}
