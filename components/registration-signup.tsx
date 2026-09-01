"use client";

import { TextInput, TextArea } from "./form-controls";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge, ErrorState, LoadingState } from "./ui";
import { BrandLogo } from "./brand-logo";
import { Icon } from "./icons";
import { PaymentProofUpload } from "./payment-proof-upload";
import { formatMoney } from "@/lib/format";
import {
  isValidMobileNumber,
  mockRegistrationConfig,
  registrationRepository,
} from "@/lib/registration-repository";
import type { RegistrationPaymentConfig } from "@/lib/types";
import type {
  AgentRegistration,
  CurrentUser,
  ReferralInvitation,
} from "@/lib/types";
import Link from "next/link";

type RegistrationStage =
  | "registration"
  | "otp_verification"
  | "payment"
  | "payment_submitted";
const flowStorageKey = "smartegy-registration-flow";
type AccountDetails = {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  passwordConfirmation: string;
  referralCode: string;
};

function actorFor(registrationId: string): CurrentUser {
  return {
    id: `user-${registrationId}`,
    role: "agent",
    displayName: "New applicant",
    email: null,
    agentId: registrationId,
  };
}

export function RegistrationSignup({
  referralCode,
}: {
  referralCode?: string;
}) {
  const suppliedReferralCode = referralCode?.trim() ?? "";
  const [invitation, setInvitation] = useState<ReferralInvitation | null>(null);
  const [referralInput, setReferralInput] = useState(suppliedReferralCode);
  const [registration, setRegistration] = useState<AgentRegistration | null>(
    null,
  );
  const [stage, setStage] = useState<RegistrationStage>("registration");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [accountDetails, setAccountDetails] = useState<AccountDetails | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<RegistrationPaymentConfig>(
    mockRegistrationConfig,
  );
  const storageId = useMemo(
    () => `${flowStorageKey}:${suppliedReferralCode.toLowerCase()}`,
    [suppliedReferralCode],
  );

  useEffect(() => {
    const invitationRequest = suppliedReferralCode
      ? registrationRepository.getInvitation(suppliedReferralCode)
      : Promise.resolve(null);
    Promise.all([invitationRequest, registrationRepository.getPaymentConfig()])
      .then(async ([result, configResult]) => {
        if (result && !result.ok) {
          setInvitationError(result.error.message);
          return;
        }
        if (configResult.ok) setPaymentConfig(configResult.data);
        if (result?.ok) {
          setInvitation(result.data);
          setReferralInput(result.data.code);
        }
        const saved = sessionStorage.getItem(storageId);
        if (!saved) return;
        try {
          const parsed = JSON.parse(saved) as {
            registrationId?: string;
            stage?: RegistrationStage;
          };
          if (!parsed.registrationId) return;
          const loaded = await registrationRepository.getRegistration(
            actorFor(parsed.registrationId),
            parsed.registrationId,
          );
          if (!loaded.ok) {
            sessionStorage.removeItem(storageId);
            return;
          }
          setRegistration(loaded.data);
          setStage(
            loaded.data.feeStatus === "rejected"
              ? "payment"
              : parsed.stage === "payment_submitted"
                ? "payment_submitted"
                : "payment",
          );
          setApplicantEmail(loaded.data.profile.email);
        } catch {
          sessionStorage.removeItem(storageId);
        }
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [suppliedReferralCode, storageId]);

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(
      () => setResendCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function saveFlow(
    nextStage: RegistrationStage,
    nextRegistration: AgentRegistration,
  ) {
    sessionStorage.setItem(
      storageId,
      JSON.stringify({ registrationId: nextRegistration.id, stage: nextStage }),
    );
    setRegistration(nextRegistration);
    setStage(nextStage);
  }

  async function sendOtp(email: string) {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    const result = await registrationRepository.sendEmailOtp(email);
    if (result.ok) {
      setApplicantEmail(email.trim().toLowerCase());
      setStage("otp_verification");
      setResendCooldown(30);
    } else {
      setError(result.error.message);
      setFieldErrors(result.error.fieldErrors ?? {});
    }
    setSubmitting(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    setFieldErrors({});

    if (stage === "registration") {
      const referralCodeValue = String(form.get("referralCode") ?? "").trim();
      let resolvedInvitation = invitation;
      if (
        referralCodeValue &&
        (!resolvedInvitation ||
          resolvedInvitation.code.toLowerCase() !==
            referralCodeValue.toLowerCase())
      ) {
        const invitationResult =
          await registrationRepository.getInvitation(referralCodeValue);
        if (!invitationResult.ok) {
          setFieldErrors({
            referralCode: [
              "This invitation or referral code is invalid or expired.",
            ],
          });
          return;
        }
        resolvedInvitation = invitationResult.data;
        setInvitation(resolvedInvitation);
      }
      const details = {
        fullName: String(form.get("fullName") ?? ""),
        email: String(form.get("email") ?? ""),
        mobileNumber: String(form.get("mobileNumber") ?? ""),
        password: String(form.get("password") ?? ""),
        passwordConfirmation: String(form.get("passwordConfirmation") ?? ""),
        referralCode: resolvedInvitation?.code ?? referralCodeValue,
      };
      const accountErrors = validateAccountForm(form);
      if (Object.keys(accountErrors).length) {
        setError("Check the highlighted fields and try again.");
        setFieldErrors(accountErrors);
        return;
      }
      setAccountDetails(details);
      await sendOtp(details.email);
      return;
    }

    if (stage === "otp_verification") {
      const otp = String(form.get("otp") ?? "").trim();
      if (!/^\d{6}$/.test(otp)) {
        setFieldErrors({ otp: ["Enter the 6-digit OTP sent to your email."] });
        return;
      }
      if (!accountDetails) {
        setStage("registration");
        setError(
          "Your registration details expired. Please complete the form again.",
        );
        return;
      }
      setSubmitting(true);
      const verified = await registrationRepository.verifyEmailOtp(
        applicantEmail,
        otp,
      );
      if (!verified.ok) {
        setError(verified.error.message);
        setFieldErrors(verified.error.fieldErrors ?? {});
        setSubmitting(false);
        return;
      }
      const created = await registrationRepository.createApplication({
        ...accountDetails,
        referralCode: accountDetails.referralCode,
        acceptedTerms: true,
      });
      if (created.ok) saveFlow("payment", created.data);
      else {
        setError(created.error.message);
        setFieldErrors(created.error.fieldErrors ?? {});
      }
      setSubmitting(false);
      return;
    }

    if (stage === "payment") {
      if (!registration) return;
      const file = form.get("proof") as File | null;
      if (!file?.name) {
        setUploadError("Upload your proof of payment to continue.");
        return;
      }
      setUploadError(null);
      setSubmitting(true);
      const submitted = await registrationRepository.submitFee(
        actorFor(registration.id),
        {
          registrationId: registration.id,
          paymentDate: null,
          paymentReference: null,
          paymentRemarks: String(form.get("paymentRemarks") ?? ""),
          proof: {
            file,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          },
        },
      );
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
  const paymentSubmitted = stage === "payment_submitted";
  const maskedEmail = applicantEmail.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
  return (
    <main className="registration-page">
      <div className="registration-header">
        <BrandLogo className="registration-brand" variant="horizontal" />
        <p>
          Already registered? <Link href="/">Sign in</Link>
        </p>
      </div>
      <div className="registration-container">
        {loading ? (
          <LoadingState />
        ) : failed ? (
          <ErrorState />
        ) : invitationError ? (
          <div className="state-card">
            <div className="state-icon state-icon-danger">!</div>
            <h3>Invitation unavailable</h3>
            <p>{invitationError}</p>
            <Link className="button button-secondary" href="/">
              Return to sign in
            </Link>
          </div>
        ) : (
          <>
            {invitation && (
              <>
                <div className="registration-intro">
                  <p className="eyebrow">
                    Agent registration ·{" "}
                    {paymentState ? "Step 2 of 2" : "Step 1 of 2"}
                  </p>
                  <h1>
                    {paymentSubmitted
                      ? "Registration submitted"
                      : paymentState
                      ? "Complete your registration"
                      : "Create your Smartegy account"}
                  </h1>
                  <p>
                    {paymentSubmitted
                      ? "Your payment proof has been received and is pending staff verification."
                      : paymentState
                      ? "Make the RM50 transfer, then submit your proof of payment for staff review."
                      : "Set up your account and verify your email to continue."}
                  </p>
                  <div className="referral-confirmation">
                    <span className="referral-check" aria-hidden="true">
                      ✓
                    </span>
                    <div>
                      <strong>
                        Referred by {invitation.referringAgentName}
                      </strong>
                      <span>
                        Invitation code {invitation.code} · Confirmed upline
                      </span>
                    </div>
                    <Badge status="verified" />
                  </div>
                </div>
              </>
            )}
            {!invitation && (
              <div className="registration-intro">
                <p className="eyebrow">Agent registration - Step 1 of 2</p>
                <h1>Create your Smartegy account</h1>
                <p>Set up your account and verify your email to continue.</p>
              </div>
            )}
            <form
              className="registration-card"
              onSubmit={handleSubmit}
              noValidate
            >
              <div
                className="onboarding-progress"
                aria-label="Registration progress"
              >
                <span
                  className={`onboarding-step ${stage === "registration" ? "active" : "completed"}`}
                >
                  <b>1</b> Account &amp; Email
                </span>
                <span className="onboarding-line" />
                <span
                  className={`onboarding-step ${stage === "otp_verification" ? "active" : stage === "payment" || stage === "payment_submitted" ? "completed" : ""}`}
                >
                  <b>2</b> OTP Verification
                </span>
                <span className="onboarding-line" />
                <span
                  className={`onboarding-step ${stage === "payment" ? "active" : stage === "payment_submitted" ? "completed" : ""}`}
                >
                  <b>3</b> Payment Proof
                </span>
              </div>
              {error && (
                <div className="login-message login-message-error" role="alert">
                  <span aria-hidden="true">!</span>
                  {error}
                </div>
              )}
              {stage === "registration" && (
                <RegistrationFields
                  fieldErrors={fieldErrors}
                  referralCode={referralInput}
                  referralLocked={Boolean(suppliedReferralCode)}
                  onReferralCodeChange={setReferralInput}
                />
              )}
              {stage === "otp_verification" && (
                <OtpStep
                  email={maskedEmail}
                  fieldErrors={fieldErrors}
                  resendCooldown={resendCooldown}
                  onResend={resendOtp}
                />
              )}
              {stage === "payment" && registration && (
                <PaymentStep
                  registration={registration}
                  paymentConfig={paymentConfig}
                  uploadError={uploadError}
                  onUploadChange={setUploadError}
                />
              )}
              {paymentSubmitted && <PaymentSubmittedStep />}
              {stage !== "payment_submitted" && (
                <button
                  className="button button-primary registration-submit"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? (
                    "Please wait…"
                  ) : stage === "registration" ? (
                    <>
                      Send OTP <Icon name="arrow" size={16} />
                    </>
                  ) : stage === "otp_verification" ? (
                    <>
                      Verify OTP <Icon name="arrow" size={16} />
                    </>
                  ) : (
                    <>
                      Submit payment proof <Icon name="arrow" size={16} />
                    </>
                  )}
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </main>
  );
}

function PaymentSubmittedStep() {
  return (
    <div className="payment-submitted-state" role="status">
      <div className="payment-submitted-icon" aria-hidden="true">
        <Icon name="check" size={28} />
      </div>
      <h2>Payment proof submitted</h2>
      <p className="payment-submitted-message">
        Payment submitted and pending staff verification. Your account will be
        activated after your registration and payment have been approved.
      </p>
    </div>
  );
}

function RegistrationFields({
  fieldErrors,
  referralCode,
  referralLocked,
  onReferralCodeChange,
}: {
  fieldErrors: Record<string, string[]>;
  referralCode: string;
  referralLocked: boolean;
  onReferralCodeChange: (value: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  return (
    <>
      <div className="form-section-heading">
        <h2>Initial information</h2>
        <p>Complete these six details to receive an email OTP.</p>
      </div>
      <div className="registration-form-grid">
        <Field id="fullName" label="Full Name" error={fieldErrors.fullName}>
          <TextInput
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Enter Your Full Name"
            required
          />
        </Field>
        <Field id="email" label="Email Address" error={fieldErrors.email}>
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Name@example.com"
            required
          />
        </Field>
        <Field
          id="mobileNumber"
          label="Mobile Number"
          error={fieldErrors.mobileNumber}
        >
          <TextInput
            id="mobileNumber"
            name="mobileNumber"
            type="tel"
            autoComplete="tel"
            placeholder="E.g. 012345678"
            required
          />
        </Field>
        <Field
          id="referralCode"
          label="Invitation / Referral Code"
          required={false}
        >
          <TextInput
            id="referralCode"
            name="referralCode"
            value={referralLocked ? "Confirmed from invitation link" : referralCode}
            onChange={(event) => onReferralCodeChange(event.target.value)}
            readOnly={referralLocked}
            placeholder="Enter An Invitation Or Referral Code"
          />
        </Field>
        <Field id="password" label="Password" error={fieldErrors.password}>
          <div className="password-input">
            <TextInput
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At Least 8 Characters"
              minLength={8}
              required
            />
            <button
              className="registration-password-toggle"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
            </button>
          </div>
        </Field>
        <Field
          id="passwordConfirmation"
          label="Confirm Password"
          error={fieldErrors.passwordConfirmation}
        >
          <div className="password-input">
            <TextInput
              id="passwordConfirmation"
              name="passwordConfirmation"
              type={showPasswordConfirmation ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter Your Password"
              minLength={8}
              required
            />
            <button
              className="registration-password-toggle"
              type="button"
              aria-label={showPasswordConfirmation ? "Hide confirmed password" : "Show confirmed password"}
              aria-pressed={showPasswordConfirmation}
              onClick={() => setShowPasswordConfirmation((visible) => !visible)}
            >
              <Icon name={showPasswordConfirmation ? "eye-off" : "eye"} size={18} />
            </button>
          </div>
        </Field>
      </div>
      <label
        className={`terms-row ${fieldErrors.acceptedTerms ? "terms-row-error" : ""}`}
      >
        <TextInput
          name="acceptedTerms"
          type="checkbox"
          required
          aria-label="Accept Terms of Use and Privacy Notice"
          aria-describedby={
            fieldErrors.acceptedTerms ? "acceptedTerms-error" : undefined
          }
        />
        <span>
          I accept the <a href="#terms">Terms of Use</a> and{" "}
          <a href="#privacy">Privacy Notice</a>.
        </span>
      </label>
      {fieldErrors.acceptedTerms && (
        <p id="acceptedTerms-error" className="field-error" role="alert">
          {fieldErrors.acceptedTerms[0]}
        </p>
      )}
    </>
  );
}

function OtpStep({
  email,
  fieldErrors,
  resendCooldown,
  onResend,
}: {
  email: string;
  fieldErrors: Record<string, string[]>;
  resendCooldown: number;
  onResend: () => void;
}) {
  return (
    <div className="otp-step">
      <div className="form-section-heading">
        <h2>Check your email</h2>
        <p>
          Enter the 6-digit verification code sent to {email}. The code expires
          in 10 minutes.
        </p>
      </div>
      <Field id="otp" label="Email OTP" error={fieldErrors.otp}>
        <TextInput
          id="otp"
          name="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="Enter Your 6-Digit Code"
          required
        />
      </Field>
      <div className="otp-actions">
        <span>Didn’t receive it?</span>
        <button
          className="text-button"
          type="button"
          disabled={resendCooldown > 0}
          onClick={onResend}
        >
          {resendCooldown ? `Resend in ${resendCooldown}s` : "Resend OTP"}
        </button>
      </div>
    </div>
  );
}

function PaymentStep({
  registration,
  paymentConfig,
  uploadError,
  onUploadChange,
}: {
  registration: AgentRegistration;
  paymentConfig: RegistrationPaymentConfig;
  uploadError: string | null;
  onUploadChange: (error: string | null) => void;
}) {
  return (
    <div className="payment-step">
      <div className="form-section-heading">
        <h2>
          Registration fee: {formatMoney(paymentConfig.feeAmountSen)}
        </h2>
        <p>
          Pay the non-refundable RM50 name-card fee, then upload your proof of
          payment.
        </p>
      </div>
      <div className="registration-invoice">
        <div>
          <p className="detail-label">Invoice</p>
          <strong>{registration.invoice.invoiceNumber}</strong>
          <span>{registration.invoice.description}</span>
        </div>
        <div>
          <p className="detail-label">Amount due</p>
          <strong>{formatMoney(registration.invoice.amountSen)}</strong>
          <span>Issued {registration.invoice.issueDate}</span>
        </div>
      </div>
      <div className="payment-account-grid">
        <div>
          <span className="detail-label">Bank name</span>
          <strong>{paymentConfig.bankName}</strong>
        </div>
        <div>
          <span className="detail-label">Account name</span>
          <strong>{paymentConfig.accountName}</strong>
        </div>
        <div>
          <span className="detail-label">Account number</span>
          <strong>{paymentConfig.accountNumber}</strong>
        </div>
        <div>
          <span className="detail-label">Transfer reference</span>
          <strong>{registration.applicationNumber}</strong>
          <small>Use this application number when making the transfer.</small>
        </div>
      </div>
      <div className="payment-qr-card">
        <strong>DuitNow QR</strong>
        <span>QR will be provided by Smartegy later.</span>
      </div>
      <div className="registration-field">
        <label htmlFor="proof">
          Proof Of Payment <span className="required-mark">*</span>
        </label>
        <PaymentProofUpload
          required
          error={uploadError ?? undefined}
          onFileChange={(file) => onUploadChange(file ? null : uploadError)}
        />
        {!uploadError && (
          <p className="field-help payment-upload-help">
            Upload the transfer confirmation for manual staff verification.
          </p>
        )}
      </div>
      <div className="registration-field">
        <label htmlFor="paymentRemarks">
          Remarks <span className="field-help-inline">(Optional)</span>
        </label>
        <TextArea
          id="paymentRemarks"
          name="paymentRemarks"
          rows={3}
          placeholder="Add Any Context For Staff, If Needed"
        />
      </div>
    </div>
  );
}

function validateAccountForm(form: FormData) {
  const errors: Record<string, string[]> = {};
  const fullName = String(form.get("fullName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const mobileNumber = String(form.get("mobileNumber") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const passwordConfirmation = String(form.get("passwordConfirmation") ?? "");
  if (!fullName) errors.fullName = ["Enter your full name."];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = ["Enter a valid email address."];
  if (!isValidMobileNumber(mobileNumber))
    errors.mobileNumber = [
      "Enter a valid mobile number, for example 012345678.",
    ];
  if (password.length < 8) errors.password = ["Use at least 8 characters."];
  if (password !== passwordConfirmation)
    errors.passwordConfirmation = ["Passwords must match."];
  if (form.get("acceptedTerms") !== "on")
    errors.acceptedTerms = [
      "Accept the Terms of Use and Privacy Notice to continue.",
    ];
  return errors;
}

function Field({
  id,
  label,
  error,
  required = true,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`registration-field ${error?.[0] ? "registration-field-error" : ""}`}
    >
      <label htmlFor={id}>
        {label}
        {required && (
          <span className="required-mark" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error?.[0] && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error[0]}
        </p>
      )}
    </div>
  );
}
