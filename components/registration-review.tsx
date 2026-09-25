"use client";

/* Signed proof URLs are rendered directly because their host is generated at runtime. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./app-shell";
import { Badge, Button, ConfirmationDialog, ErrorState, LoadingState, PermissionDenied } from "./ui";
import { DataTable } from "./data-table";
import { DatePicker } from "./date-picker";
import { PopupModal } from "./popup-modal";
import { TextInput, TextArea } from "./form-controls";
import { Toast, type ToastTone } from "./toast";
import { formatDate, formatMoney } from "@/lib/format";
import { registrationRepository } from "@/lib/registration-repository";
import { usePreviewUser } from "@/lib/preview-user";
import type { AgentRegistration, RegistrationActionResult, RegistrationPaymentProofAccess, VerifyRegistrationFeeInput } from "@/lib/types";

type ReviewAction = "verify" | "reject-fee";

export function RegistrationReviewPage({ applicationNumber }: { applicationNumber: string }) {
  const { role, user, setRole } = usePreviewUser("staff");
  const [registration, setRegistration] = useState<AgentRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; subtitle: string; tone: ToastTone } | null>(null);
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [paymentReason, setPaymentReason] = useState("");
  const [paymentRejectionError, setPaymentRejectionError] = useState(false);
  const [verification, setVerification] = useState<VerifyRegistrationFeeInput | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [proofAccess, setProofAccess] = useState<RegistrationPaymentProofAccess | null>(null);
  useEffect(() => { setAction(null); setVerification(null); setProofAccess(null); setPaymentReason(""); setPaymentRejectionError(false); setActionLoading(false); }, [applicationNumber]);
  const load = useCallback(async () => { setLoading(true); setError(null); const result = await registrationRepository.getByApplicationNumber(user, applicationNumber); if (result.ok) setRegistration(result.data); else setError(JSON.stringify(result.error.response ?? { message: result.error.message }, null, 2)); setLoading(false); }, [applicationNumber, user]);
  useEffect(() => { void load(); }, [load]);
  async function run(resultPromise: Promise<RegistrationActionResult<AgentRegistration>>, success: string) { setActionLoading(true); try { const result = await resultPromise; if (result.ok) { setRegistration(result.data); setToast({ title: result.warning ? "Action completed with warning" : "Action completed", subtitle: result.warning ?? success, tone: result.warning ? "error" : "success" }); setAction(null); setPaymentReason(""); } else setToast({ title: "Action failed", subtitle: result.error.message, tone: "error" }); } finally { setActionLoading(false); } }
  if (role === "agent") return <AppShell user={user} onRoleChange={setRole}><div className="page-content"><PermissionDenied/></div></AppShell>;
  return <AppShell user={user} onRoleChange={setRole}><div className="page-content registration-detail-page"><Link className="profile-back-button" href="/registrations"><span aria-hidden="true">&lt;</span> Back to Registration Queue</Link>{loading ? <LoadingState/> : error ? <ErrorState response={error} onRetry={load}/> : registration ? <>
    <div className="page-header registration-detail-header"><div><p className="eyebrow">Registration Review</p><h1>{registration.applicationNumber}</h1><p className="page-description">{registration.profile.fullName} · submitted {registration.submittedAt ? formatDate(registration.submittedAt) : "not submitted"}</p></div></div>
    {toast && <Toast title={toast.title} subtitle={toast.subtitle} tone={toast.tone} onDismiss={() => setToast(null)} />}

    <div className="registration-detail-grid">
      <section className="panel detail-panel applicant-panel"><div className="panel-header"><div><h2>Applicant Information</h2><p>Confirmed registration details and upline.</p></div></div><dl className="detail-list detail-list-wide"><Detail label="Application number" value={registration.applicationNumber}/><Detail label="Full name" value={registration.profile.fullName}/><Detail label="Email address" value={registration.profile.email}/><Detail label="Mobile number" value={registration.profile.mobileNumber}/><Detail label="Referral code" value={registration.referralCode}/><Detail label="Confirmed upline" value={registration.referringAgentName}/><Detail label="Submitted" value={registration.submittedAt ? formatDate(registration.submittedAt) : "Not submitted"}/><Detail label="Email verification" value={<Badge status={registration.emailVerified ? "verified" : "unpaid"}/>}/></dl></section>
      <section className="panel detail-panel audit-section"><div className="panel-header"><div><h2>Audit History</h2><p>Internal activity for this application and payment review.</p></div></div>{registration.audit.length ? <DataTable caption="Registration audit history" headers={["Action", "Acting staff user", "Status change", "Reason or note"]}>{registration.audit.map((event) => <tr key={event.id}><td><span className="table-primary">{event.action.replaceAll("_", " ")}</span><span className="table-secondary">{formatDate(event.occurredAt)}</span></td><td>{event.actorDisplayName}</td><td>{event.previousStatus ?? "—"} → {event.newStatus ?? "—"}</td><td className="muted-cell">{event.reason ?? "—"}</td></tr>)}</DataTable> : <p className="detail-empty">No review activity recorded yet.</p>}</section>
    <PaymentReview actor={user} registration={registration} showVerificationFields={action !== "reject-fee"} resendLoading={actionLoading} onProof={setProofAccess} onVerify={(details) => { setVerification(details); setAction("verify"); }} onReject={() => { setPaymentRejectionError(false); setAction("reject-fee"); }} onResend={async () => { setActionLoading(true); const result = await registrationRepository.sendFeeRejectionEmail(user, registration.id); setToast(result.ok ? { title: "Notification sent", subtitle: "The applicant has been emailed the payment rejection reason.", tone: "success" } : { title: "Notification failed", subtitle: result.error.message, tone: "error" }); setActionLoading(false); }}/>
    </div>
    <ConfirmationDialog open={action === "verify"} title="Verify Payment?" description={`This verifies the RM50.00 fee for ${registration.applicationNumber}. If email and profile requirements are complete, the application will automatically be approved and activated.`} confirmLabel="Verify Payment" confirmVariant="primary" loading={actionLoading} onCancel={() => setAction(null)} onConfirm={() => verification && void run(registrationRepository.verifyFee(user, verification), "Payment Verified. Complete applications are automatically approved and activated.")}/>
    <ConfirmationDialog open={action === "reject-fee"} title="Reject Payment Proof?" description={`This marks the fee for ${registration.applicationNumber} as rejected and lets the applicant resubmit proof.`} confirmLabel="Reject Payment" loading={actionLoading} onCancel={() => { setAction(null); setPaymentRejectionError(false); }} onConfirm={() => { if (!paymentReason.trim()) { setPaymentRejectionError(true); return; } void run(registrationRepository.rejectFee(user, { registrationId: registration.id, reason: paymentReason }), "Payment Rejected. The applicant can resubmit proof."); }}><label className="case-field"><span>Payment rejection reason *</span><TextArea value={paymentReason} onChange={(event) => { setPaymentRejectionError(false); setPaymentReason(event.target.value); }} placeholder="Enter a clear reason" aria-invalid={paymentRejectionError} required /></label>{paymentRejectionError && <p className="field-error" role="alert">Enter a rejection reason before confirming.</p>}</ConfirmationDialog>
    <PopupModal open={Boolean(proofAccess)} className="document-preview-modal" title={proofAccess ? `Proof of payment — ${proofAccess.fileName}` : "Proof of payment"} description={proofAccess ? `Secure access expires ${formatDate(proofAccess.expiresAt)}.` : undefined} onClose={() => setProofAccess(null)} size="lg" tone="neutral" bodyClassName="registration-proof-viewer" footer={proofAccess && <>{/^https?:\/\//i.test(proofAccess.accessToken) && <a className="button button-secondary" href={proofAccess.accessToken} target="_blank" rel="noreferrer">Open in new tab</a>}<Button variant="secondary" onClick={() => setProofAccess(null)}>Close</Button></>}>
      {proofAccess && <ProofViewer proof={proofAccess} />}
    </PopupModal>
    </> : null}</div></AppShell>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }

function ProofViewer({ proof }: { proof: RegistrationPaymentProofAccess }) {
  const hasUrl = /^https?:\/\//i.test(proof.accessToken);
  if (!hasUrl) {
    return <div className="registration-proof-unavailable"><p>Protected access granted for <strong>{proof.fileName}</strong>.</p><p>The local preview repository does not contain the uploaded file bytes.</p></div>;
  }
  const isImage = proof.mimeType.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(proof.fileName);
  if (isImage) return <img className="registration-proof-image" src={proof.accessToken} alt={`Proof of payment: ${proof.fileName}`} />;
  return <iframe className="registration-proof-pdf" src={proof.accessToken} title={`Proof of payment: ${proof.fileName}`} />;
}

function PaymentReview({ actor, registration, showVerificationFields, resendLoading, onProof, onVerify, onReject, onResend }: { actor: Parameters<typeof registrationRepository.getPaymentProof>[0]; registration: AgentRegistration; showVerificationFields: boolean; resendLoading: boolean; onProof: (proof: RegistrationPaymentProofAccess) => void; onVerify: (details: VerifyRegistrationFeeInput) => void; onReject: () => void; onResend: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const [amount, setAmount] = useState("50.00");
  const [date, setDate] = useState(() => registration.verifiedPaymentDate ?? registration.paymentDate ?? new Date().toISOString().slice(0, 10));
  const [fieldErrors, setFieldErrors] = useState<{ amount?: string; date?: string }>({});
  const reference = registration.paymentReference ?? "Manual verification";
  const [note, setNote] = useState("");
  const previousRejectionReason = registration.previousRejectionReason ?? registration.rejectionReason ?? registration.audit.find((event) => event.reason)?.reason ?? "None";
  useEffect(() => { setAmount(((registration.verifiedAmountSen ?? registration.feeAmountSen) / 100).toFixed(2)); setDate(registration.verifiedPaymentDate ?? registration.paymentDate ?? new Date().toISOString().slice(0, 10)); setFieldErrors({}); }, [registration.id, registration.verifiedAmountSen, registration.feeAmountSen, registration.verifiedPaymentDate, registration.paymentDate]);
  function verify() {
    const errors: typeof fieldErrors = {};
    const parsedAmount = Number(amount);
    if (!amount.trim()) errors.amount = "Verified amount is required.";
    else if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) errors.amount = "Enter a valid verified amount.";
    else if (Math.round(parsedAmount * 100) !== registration.feeAmountSen) errors.amount = `Verified amount must be exactly ${formatMoney(registration.feeAmountSen)}.`;
    if (!date) errors.date = "Verified payment date is required.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    onVerify({ registrationId: registration.id, verifiedAmountSen: Math.round(parsedAmount * 100), paymentDate: date, bankReference: reference, note: note.trim() || undefined });
  }

  return (
    <section className="panel detail-panel payment-review-panel">
      <div className="panel-header">
        <div>
          <h2>Payment-Proof Review</h2>
          <p>Required registration fee: {formatMoney(registration.feeAmountSen)}</p>
        </div>
        <Badge status={registration.feeStatus} />
      </div>
      <dl className="detail-list detail-list-wide">
        <Detail label="Submitted payment date" value={registration.paymentDate ? formatDate(registration.paymentDate) : "Not provided"} />
        <Detail
          label="Proof of payment"
          value={registration.proof ? <button className="text-link" type="button" disabled={loadingProof} onClick={async () => {
            setLoadingProof(true);
            setMessage(null);
            const result = await registrationRepository.getPaymentProof(actor, registration.id);
            if (result.ok) onProof(result.data);
            else setMessage(result.error.message);
            setLoadingProof(false);
          }}>{loadingProof ? "Opening proof…" : `View securely: ${registration.proof.fileName}`}</button> : "Not uploaded"}
        />
        <Detail label="Previous rejection reason" value={previousRejectionReason} />
      </dl>
      {message && <p className="field-error" role="alert">{message}</p>}
      {registration.feeStatus === "rejected" && <div className="review-actions"><Button variant="secondary" loading={resendLoading} onClick={onResend}>Resend rejection email</Button></div>}
      {registration.feeStatus === "pending_verification" && <div className="verification-form">
        {showVerificationFields && <>
          <p className="verification-form-heading">Staff Verification Fields</p>
          <label><span>Verified amount (RM) <span className="required-mark">*</span></span><TextInput inputMode="decimal" value={amount} onChange={(event) => { setFieldErrors((current) => ({ ...current, amount: undefined })); setAmount(event.target.value); }} aria-invalid={Boolean(fieldErrors.amount)} aria-describedby={fieldErrors.amount ? "verified-amount-error" : undefined} required /></label>
          {fieldErrors.amount && <p id="verified-amount-error" className="field-error" role="alert">{fieldErrors.amount}</p>}
          <div className="verification-date-field"><span>Verified payment date <span className="required-mark">*</span></span><DatePicker id="verified-payment-date" value={date} placeholder="DD/MM/YYYY" onChange={(value) => { setFieldErrors((current) => ({ ...current, date: undefined })); setDate(value); }} required ariaLabel="Verified payment date" /></div>
          {fieldErrors.date && <p id="verified-payment-date-error" className="field-error" role="alert">{fieldErrors.date}</p>}
          <label>Internal Staff Note<TextArea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Only authorised staff can see this note" /></label>
        </>}
        <div className="review-actions">
          <Button onClick={verify}>Verify Payment</Button>
          <Button variant="danger" onClick={onReject}>Reject Payment</Button>
        </div>
      </div>}
    </section>
  );
}
