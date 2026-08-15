import { TextInput, TextArea } from "./form-controls";
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge, ErrorState, LoadingState } from "./ui";
import { BrandLogo } from "./brand-logo";
import { Icon } from "./icons";
import { PaymentProofUpload } from "./payment-proof-upload";
import { formatMoney } from "@/lib/format";
import { isValidMobileNumber, mockRegistrationConfig, registrationRepository } from "@/lib/registration-repository";
import type { AgentRegistration, CurrentUser, ReferralInvitation } from "@/lib/types";

type RegistrationStage = "registration" | "otp_verification" | "payment" | "payment_submitted";
const flowStorageKey = "smartegy-registration-flow";
type AccountDetails = { fullName: string; email: string; mobileNumber: string; password: string; passwordConfirmation: string };

function actorFor(registrationId: string): CurrentUser { return { id: `user-${registrationId}`, role: "agent", displayName: "New applicant", email: null, agentId: registrationId }; }

export function RegistrationSignup({ referralCode }: { referralCode: string }) {
  const [invitation, setInvitation] = useState<ReferralInvitation | null>(null);
  const [registration, setRegistration] = useState<AgentRegistration | null>(null);
  const [stage, setStage] = useState<RegistrationStage>("registration");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [accountDetails, setAccountDetails] = useState<AccountDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const storageId = useMemo(() => `${flowStorageKey}:${referralCode.toLowerCase()}`, [referralCode]);

  useEffect(() => {
    registrationRepository.getInvitation(referralCode).then(async (result) => {
      if (!result.ok) { setInvitationError(result.error.message); return; }
      setInvitation(result.data);
      const saved = sessionStorage.getItem(storageId);
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as { registrationId?: string; stage?: RegistrationStage };
        if (!parsed.registrationId) return;
        const loaded = await registrationRepository.getRegistration(actorFor(parsed.registrationId), parsed.registrationId);
        if (!loaded.ok) { sessionStorage.removeItem(storageId); return; }
        setRegistration(loaded.data);
        setStage(loaded.data.feeStatus === "rejected" ? "payment" : parsed.stage === "payment_submitted" ? "payment_submitted" : "payment");
        setApplicantEmail(loaded.data.profile.email);
      } catch { sessionStorage.removeItem(storageId); }
    }).catch(() => setFailed(true)).finally(() => setLoading(false));
  }, [referralCode, storageId]);

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function saveFlow(nextStage: RegistrationStage, nextRegistration: AgentRegistration) {
    sessionStorage.setItem(storageId, JSON.stringify({ registrationId: nextRegistration.id, stage: nextStage }));
    setRegistration(nextRegistration);
    setStage(nextStage);
  }

  async function sendOtp(email: string) {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    const result = await registrationRepository.sendEmailOtp(email);
    if (result.ok) { setApplicantEmail(email.trim().toLowerCase()); setStage("otp_verification"); setResendCooldown(30); }
    else { setError(result.error.message); setFieldErrors(result.error.fieldErrors ?? {}); }
    setSubmitting(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitation || submitting) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    setFieldErrors({});

    if (stage === "registration") {
      const details = { fullName: String(form.get("fullName") ?? ""), email: String(form.get("email") ?? ""), mobileNumber: String(form.get("mobileNumber") ?? ""), password: String(form.get("password") ?? ""), passwordConfirmation: String(form.get("passwordConfirmation") ?? "") };
      const accountErrors = validateAccountForm(form);
      if (Object.keys(accountErrors).length) { setError("Check the highlighted fields and try again."); setFieldErrors(accountErrors); return; }
      setAccountDetails(details);
      await sendOtp(details.email);
      return;
    }

    if (stage === "otp_verification") {
      const otp = String(form.get("otp") ?? "").trim();
      if (!/^\d{6}$/.test(otp)) { setFieldErrors({ otp: ["Enter the 6-digit OTP sent to your email."] }); return; }
      if (!accountDetails) { setStage("registration"); setError("Your registration details expired. Please complete the form again."); return; }
      setSubmitting(true);
      const verified = await registrationRepository.verifyEmailOtp(applicantEmail, otp);
      if (!verified.ok) { setError(verified.error.message); setFieldErrors(verified.error.fieldErrors ?? {}); setSubmitting(false); return; }
      const created = await registrationRepository.createApplication({ ...accountDetails, referralCode: invitation.code, acceptedTerms: true });
      if (created.ok) saveFlow("payment", created.data);
      else { setError(created.error.message); setFieldErrors(created.error.fieldErrors ?? {}); }
      setSubmitting(false);
      return;
    }

    if (stage === "payment") {
      if (!registration) return;
      const file = form.get("proof") as File | null;
      if (!file?.name) { setUploadError("Upload your proof of payment to continue."); return; }
      setUploadError(null);
      setSubmitting(true);
      const submitted = await registrationRepository.submitFee(actorFor(registration.id), { registrationId: registration.id, paymentDate: null, paymentReference: null, paymentRemarks: String(form.get("paymentRemarks") ?? ""), proof: { fileName: file?.name ?? "", mimeType: file?.type ?? "", sizeBytes: file?.size ?? 0 } });
      if (submitted.ok) saveFlow("payment_submitted", submitted.data);
      else setError(submitted.error.message);
      setSubmitting(false);
    }
  }

  async function resendOtp() {
    if (resendCooldown || !applicantEmail || submitting) return;
    await sendOtp(applicantEmail);
  }


  const paymentState = stage === "payment" || stage === "payment_submitted";
  const maskedEmail = applicantEmail.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
  return <main className="registration-page">
    <div className="registration-header"><BrandLogo className="registration-brand" /><p>Already registered? <a href="/">Sign in</a></p></div>
    <div className="registration-container">
      {loading ? <LoadingState /> : failed ? <ErrorState /> : invitationError ? <div className="state-card"><div className="state-icon state-icon-danger">!</div><h3>Invitation unavailable</h3><p>{invitationError}</p><a className="button button-secondary" href="/">Return to sign in</a></div> : invitation ? <>
        <div className="registration-intro"><p className="eyebrow">Agent registration · {paymentState ? "Step 2 of 2" : "Step 1 of 2"}</p><h1>{paymentState ? "Complete your registration" : "Create your Smartegy account"}</h1><p>{paymentState ? "Make the RM50 transfer, then submit your proof of payment for staff review." : "Set up your account and verify your email to continue."}</p><div className="referral-confirmation"><span className="referral-check" aria-hidden="true">✓</span><div><strong>Referred by {invitation.referringAgentName}</strong><span>Invitation code {invitation.code} · Confirmed upline</span></div><Badge status="verified" /></div></div>
        <form className="registration-card" onSubmit={handleSubmit} noValidate>
          <div className="onboarding-progress" aria-label="Registration progress"><span className={`onboarding-step ${stage === "registration" ? "active" : "completed"}`}><b>1</b> Account &amp; email</span><span className="onboarding-line" /><span className={`onboarding-step ${stage === "otp_verification" ? "active" : stage === "payment" || stage === "payment_submitted" ? "completed" : ""}`}><b>2</b> OTP Verification</span><span className="onboarding-line" /><span className={`onboarding-step ${paymentState ? "active" : ""}`}><b>3</b> Payment proof</span></div>
          {error && <div className="login-message login-message-error" role="alert"><span aria-hidden="true">!</span>{error}</div>}
          {stage === "registration" && <RegistrationFields fieldErrors={fieldErrors} />}
          {stage === "otp_verification" && <OtpStep email={maskedEmail} fieldErrors={fieldErrors} resendCooldown={resendCooldown} onResend={resendOtp} />}
          {paymentState && registration && <PaymentStep registration={registration} uploadError={uploadError} onUploadChange={setUploadError} />}
          {stage !== "payment_submitted" && <button className="button button-primary registration-submit" type="submit" disabled={submitting}>{submitting ? "Please wait…" : stage === "registration" ? <>Send OTP <Icon name="arrow" size={16} /></> : stage === "otp_verification" ? <>Verify OTP <Icon name="arrow" size={16} /></> : <>Submit payment proof <Icon name="arrow" size={16} /></>}</button>}
          {stage === "payment_submitted" && <div className="payment-submitted-state" role="status"><p className="success-copy">Payment submitted and pending staff verification. Your account will be activated after your registration and payment have been approved.</p></div>}
        </form>
      </> : null}
    </div>
  </main>;
}

function RegistrationFields({ fieldErrors }: { fieldErrors: Record<string, string[]> }) {
  return <><div className="form-section-heading"><h2>Initial information</h2><p>Complete these six details to receive an email OTP.</p></div><div className="registration-form-grid"><Field id="fullName" label="Full name" error={fieldErrors.fullName}><TextInput id="fullName" name="fullName" type="text" autoComplete="name" required /></Field><Field id="email" label="Email address" error={fieldErrors.email}><TextInput id="email" name="email" type="email" autoComplete="email" required /></Field><Field id="mobileNumber" label="Mobile number" error={fieldErrors.mobileNumber}><TextInput id="mobileNumber" name="mobileNumber" type="tel" autoComplete="tel" placeholder="e.g. 012345678" required /></Field><Field id="referralCode" label="Invitation / referral code"><TextInput id="referralCode" value="Confirmed from invitation link" readOnly /></Field><Field id="password" label="Password" error={fieldErrors.password}><TextInput id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></Field><Field id="passwordConfirmation" label="Confirm password" error={fieldErrors.passwordConfirmation}><TextInput id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} required /></Field></div><p className="field-help">Your confirmed upline cannot be changed by the applicant.</p><label className={`terms-row ${fieldErrors.acceptedTerms ? "terms-row-error" : ""}`}><TextInput name="acceptedTerms" type="checkbox" required aria-describedby={fieldErrors.acceptedTerms ? "acceptedTerms-error" : undefined} /><span>I accept the <a href="#terms">Terms of Use</a> and <a href="#privacy">Privacy Notice</a>.</span></label>{fieldErrors.acceptedTerms && <p id="acceptedTerms-error" className="field-error" role="alert">{fieldErrors.acceptedTerms[0]}</p>}</>;
}

function OtpStep({ email, fieldErrors, resendCooldown, onResend }: { email: string; fieldErrors: Record<string, string[]>; resendCooldown: number; onResend: () => void }) {
  return <div className="otp-step"><div className="form-section-heading"><h2>Check your email</h2><p>Enter the 6-digit verification code sent to {email}. The code expires in 10 minutes.</p></div><Field id="otp" label="Email OTP" error={fieldErrors.otp}><TextInput id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter your 6-digit code" required /></Field><div className="otp-actions"><span>Didn’t receive it?</span><button className="text-button" type="button" disabled={resendCooldown > 0} onClick={onResend}>{resendCooldown ? `Resend in ${resendCooldown}s` : "Resend OTP"}</button></div></div>;
}

function PaymentStep({ registration, uploadError, onUploadChange }: { registration: AgentRegistration; uploadError: string | null; onUploadChange: (error: string | null) => void }) {
  return <div className="payment-step"><div className="form-section-heading"><h2>Registration fee: {formatMoney(mockRegistrationConfig.feeAmountSen)}</h2><p>Pay the non-refundable RM50 name-card fee, then upload your proof of payment.</p></div><div className="registration-invoice"><div><p className="detail-label">Invoice</p><strong>{registration.invoice.invoiceNumber}</strong><span>{registration.invoice.description}</span></div><div><p className="detail-label">Amount due</p><strong>{formatMoney(registration.invoice.amountSen)}</strong><span>Issued {registration.invoice.issueDate}</span></div></div><div className="payment-account-grid"><div><span className="detail-label">Bank name</span><strong>{mockRegistrationConfig.bankName}</strong></div><div><span className="detail-label">Account name</span><strong>{mockRegistrationConfig.accountName}</strong></div><div><span className="detail-label">Account number</span><strong>{mockRegistrationConfig.accountNumber}</strong></div><div><span className="detail-label">Transfer reference</span><strong>{registration.applicationNumber}</strong><small>Use this application number when making the transfer.</small></div></div><div className="payment-qr-card"><strong>DuitNow QR</strong><span>QR will be provided by Smartegy later.</span></div><div className="registration-field"><label htmlFor="proof">Proof of payment</label><PaymentProofUpload error={uploadError ?? undefined} onFileChange={(file) => onUploadChange(file ? null : uploadError)} />{!uploadError && <p className="field-help payment-upload-help">Upload the transfer confirmation for manual staff verification.</p>}</div><div className="registration-field"><label htmlFor="paymentRemarks">Remarks <span className="field-help-inline">(optional)</span></label><TextArea id="paymentRemarks" name="paymentRemarks" rows={3} placeholder="Add any context for staff, if needed" /></div></div>;
}

function validateAccountForm(form: FormData) {
  const errors: Record<string, string[]> = {};
  const fullName = String(form.get("fullName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const mobileNumber = String(form.get("mobileNumber") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const passwordConfirmation = String(form.get("passwordConfirmation") ?? "");
  if (!fullName) errors.fullName = ["Enter your full name."];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = ["Enter a valid email address."];
  if (!isValidMobileNumber(mobileNumber)) errors.mobileNumber = ["Enter a valid mobile number, for example 012345678."];
  if (password.length < 8) errors.password = ["Use at least 8 characters."];
  if (password !== passwordConfirmation) errors.passwordConfirmation = ["Passwords must match."];
  if (form.get("acceptedTerms") !== "on") errors.acceptedTerms = ["Accept the Terms of Use and Privacy Notice to continue."];
  return errors;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string[]; children: React.ReactNode }) { return <div className={`registration-field ${error?.[0] ? "registration-field-error" : ""}`}><label htmlFor={id}>{label}</label>{children}{error?.[0] && <p id={`${id}-error`} className="field-error" role="alert">{error[0]}</p>}</div>; }
