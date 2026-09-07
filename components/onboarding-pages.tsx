"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { PaymentProofUpload } from "./payment-proof-upload";
import { TextArea } from "./form-controls";
import { DatePicker } from "./date-picker";
import { Badge, Button, LoadingState, PermissionDenied } from "./ui";
import { registrationRepository } from "@/lib/registration-repository";
import { usePreviewUser } from "@/lib/preview-user";
import type { AgentRegistration } from "@/lib/types";

function DisabledAccountCard() {
  return <div className="status-disabled-card" role="alert"><div className="status-disabled-icon" aria-hidden="true">!</div><div><p className="eyebrow">Account access disabled</p><h2>Contact an administrator to reactivate your account</h2><p>Your account has been disabled by an administrator. Please request that the administrator make your account active again.</p></div></div>;
}

export function RegistrationStatusPage() {
  const { user, ready } = usePreviewUser();
  const [registration, setRegistration] = useState<AgentRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    registrationRepository.getRegistration(user, "").then((result) => result.ok && setRegistration(result.data)).finally(() => setLoading(false));
  }, [ready, user]);

  async function resubmitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!registration || !paymentProof || !paymentDate || submittingPayment) {
      if (!paymentProof) setPaymentError("Upload your proof of payment to continue.");
      else if (!paymentDate) setPaymentError("Enter the payment date to continue.");
      return;
    }
    setSubmittingPayment(true);
    setPaymentError(null);
    setPaymentSuccess(null);
    const result = await registrationRepository.submitFee(user, {
      registrationId: registration.id,
      paymentDate,
      paymentReference: registration.paymentReference,
      paymentRemarks: paymentRemarks.trim() || registration.paymentRemarks,
      proof: {
        file: paymentProof,
        fileName: paymentProof.name,
        mimeType: paymentProof.type,
        sizeBytes: paymentProof.size,
      },
    });
    if (result.ok) {
      setRegistration(result.data);
      setPaymentProof(null);
      setPaymentDate("");
      setPaymentRemarks("");
      setPaymentSuccess("Your new payment proof has been submitted and is pending staff verification.");
    } else {
      setPaymentError(result.error.message);
    }
    setSubmittingPayment(false);
  }

  if (!ready || loading) return <div className="page-content"><LoadingState /></div>;
  const inactive = user.accountStatus === "inactive";
  if (!registration) return inactive ? <div className="page-content"><section className="panel status-panel"><div className="status-panel-icon status-panel-icon-disabled">!</div><p className="eyebrow">Account status</p><h1>Your Account Is Disabled</h1><p>Your access to Smartegy has been disabled by an administrator.</p><DisabledAccountCard /></section></div> : <div className="page-content"><PermissionDenied /></div>;
  const active = registration.registrationStatus === "active" && !inactive;
  const paymentRejected = registration.feeStatus === "rejected";
  const showPaymentPanel = !inactive && (paymentRejected || Boolean(paymentSuccess));

  return (
    <div className="page-content onboarding-status-cards">
      <section className="panel status-panel">
        <div className={`status-panel-icon ${inactive ? "status-panel-icon-disabled" : ""}`}>
          {active ? "✓" : "i"}
        </div>
        <p className="eyebrow">Registration status</p>
        <h1>
          {inactive
            ? "Your Account Is Disabled"
            : active
              ? "Your Agent Account Is Active"
              : "Your Registration Is Being Reviewed"}
        </h1>
        <p>
          {inactive
            ? "Your access to Smartegy has been disabled by an administrator."
            : active
              ? "All requirements are complete. You can now access the active agent workspace."
              : paymentRejected
                ? "Your payment proof needs an update before staff can continue reviewing your registration."
                : "Your registration and payment proof are awaiting administrator verification. You will be able to submit cases once your account has been activated."}
        </p>
        <div className="status-summary">
          <span>Registration <Badge status={registration.registrationStatus} /></span>
          <span>Fee <Badge status={registration.feeStatus} /></span>
          <span>Email <Badge status={registration.emailVerified ? "verified" : "pending_verification"} /></span>
          <span>Profile <Badge status={registration.profileComplete ? "verified" : "draft"} /></span>
        </div>
        {inactive && <DisabledAccountCard />}
        {active && <Link className="button button-primary" href="/dashboard">Open Agent Workspace</Link>}
      </section>

      {showPaymentPanel && (
        <section className="panel status-payment-panel">
          {paymentRejected ? (
            <>
              <div className="login-message login-message-error" role="alert">
                <span aria-hidden="true">!</span>
                {registration.rejectionReason || "Staff rejected the payment proof. Please upload a new proof of payment."}
              </div>
              <form className="status-payment-resubmission" onSubmit={resubmitPayment}>
                <div className="status-payment-heading">
                  <h2>Submit new payment proof</h2>
                  <p>Upload a clearer or corrected proof for staff and admin review.</p>
                </div>
                <div className="registration-field">
                  <label htmlFor="replacement-payment-proof">Proof Of Payment <span className="required-mark">*</span></label>
                  <PaymentProofUpload
                    name="replacement-payment-proof"
                    documentType="payment_proof"
                    error={paymentError ?? undefined}
                    onFileChange={(file) => {
                      setPaymentProof(file);
                      setPaymentError(null);
                      setPaymentSuccess(null);
                    }}
                  />
                  {!paymentError && <p className="field-help payment-upload-help">Accepted: PDF, JPG, PNG, or WEBP up to 10 MB.</p>}
                </div>
                <div className="registration-field">
                  <DatePicker
                    id="replacement-payment-date"
                    title="Payment Date"
                    value={paymentDate}
                    placeholder="DD/MM/YYYY"
                    onChange={(value) => {
                      setPaymentDate(value);
                      setPaymentError(null);
                    }}
                    required
                  />
                </div>
                <div className="registration-field">
                  <label htmlFor="replacement-payment-remarks">Remarks <span className="field-help-inline">(Optional)</span></label>
                  <TextArea
                    id="replacement-payment-remarks"
                    rows={3}
                    value={paymentRemarks}
                    onChange={(event) => setPaymentRemarks(event.target.value)}
                    placeholder="Add context for staff, if needed"
                  />
                </div>
                <Button type="submit" disabled={submittingPayment}>
                  {submittingPayment ? "Submitting…" : "Submit new proof"}
                </Button>
              </form>
            </>
          ) : (
            <div className="status-payment-success" role="status">
              <div className="status-panel-icon" aria-hidden="true">✓</div>
              <p className="eyebrow">Payment proof submitted</p>
              <h2>Your Payment Proof Has Been Submitted</h2>
              <p>{paymentSuccess}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
