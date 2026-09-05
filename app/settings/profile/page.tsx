"use client";

import { TextInput, TextArea } from "@/components/form-controls";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createAvatar } from "@dicebear/core";
import { initials as avatarStyle } from "@dicebear/collection";
import { AppShell } from "@/components/app-shell";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  PermissionDenied,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { agentProfileRepository } from "@/lib/profile-repository";
import { MALAYSIAN_BANKS } from "@/lib/malaysian-banks";
import { usePreviewUser } from "@/lib/preview-user";
import { formatDate } from "@/lib/format";
import type {
  AgentProfile,
  CurrentUser,
  UpdateAgentBankDetailsInput,
  UpdateAgentProfileInput,
} from "@/lib/types";

export default function ProfilePage() {
  const { user, setRole } = usePreviewUser();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [state, setState] = useState<"loading" | "error" | "permission">(
    "loading",
  );
  const load = useCallback(() => {
    setState("loading");
    agentProfileRepository.getMine(user).then((result) => {
      if (result.ok) {
        setProfile(result.data);
        setState("loading");
      } else
        setState(result.error.code === "FORBIDDEN" ? "permission" : "error");
    });
  }, [user]);
  useEffect(() => {
    if (user.role === "agent") load();
  }, [load, user.role]);
  if (user.role !== "agent")
    return (
      <AppShell user={user} onRoleChange={setRole} hideSidebar>
        <main className="page-content profile-page">
          <ProfileAccount user={user} />
        </main>
      </AppShell>
    );
  return (
    <AppShell user={user} onRoleChange={setRole} hideSidebar>
      <main className="page-content profile-page">
        {state === "loading" && !profile ? (
          <LoadingState />
        ) : state === "permission" ? (
          <PermissionDenied />
        ) : state === "error" || !profile ? (
          <ErrorState onRetry={load} />
        ) : (
          <ProfileContent profile={profile} user={user} />
        )}
      </main>
    </AppShell>
  );
}

function ProfileContent({
  profile,
  user,
}: {
  profile: AgentProfile;
  user: CurrentUser;
}) {
  const router = useRouter();
  const pending =
    profile.registrationStatus !== "active" ||
    profile.accountStatus !== "active";
  const [form, setForm] = useState<UpdateAgentProfileInput>(() => ({
    ...profile.profile,
  }));
  const [savedProfile, setSavedProfile] = useState(() => ({
    ...profile.profile,
  }));
  const [bankForm, setBankForm] = useState<UpdateAgentBankDetailsInput>(() =>
    profile.bankDetails
      ? {
          bankName: profile.bankDetails.bankName,
          accountHolderName: profile.bankDetails.accountHolderName,
          accountNumber: profile.bankDetails.accountNumber,
        }
      : { bankName: "", accountHolderName: "", accountNumber: "" },
  );
  const [savedBankDetails, setSavedBankDetails] =
    useState<UpdateAgentBankDetailsInput>(() =>
      profile.bankDetails
        ? {
            bankName: profile.bankDetails.bankName,
            accountHolderName: profile.bankDetails.accountHolderName,
            accountNumber: profile.bankDetails.accountNumber,
          }
        : { bankName: "", accountHolderName: "", accountNumber: "" },
    );
  const [emailVerified, setEmailVerified] = useState(profile.emailVerified);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [copiedReferral, setCopiedReferral] = useState<"link" | "code" | null>(
    null,
  );
  const [referralLink, setReferralLink] = useState(
    `/join/${profile.referralCode}`,
  );
  const changed =
    form.fullName !== savedProfile.fullName ||
    form.mobileNumber !== savedProfile.mobileNumber ||
    form.email !== savedProfile.email;
  const bankChanged =
    bankForm.bankName !== savedBankDetails.bankName ||
    bankForm.accountHolderName !== savedBankDetails.accountHolderName ||
    bankForm.accountNumber !== savedBankDetails.accountNumber;
  const emailChanged =
    form.email.trim().toLowerCase() !== savedProfile.email.toLowerCase();
  const initials = useMemo(
    () =>
      profile.profile.fullName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [profile.profile.fullName],
  );
  const avatarSrc = useMemo(
    () =>
      createAvatar(avatarStyle, {
        seed: profile.profile.fullName,
        backgroundColor: ["d3edf1"],
        radius: 50,
        size: 128,
      }).toDataUri(),
    [profile.profile.fullName],
  );
  function update(field: keyof UpdateAgentProfileInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: [] }));
    setFeedback(null);
  }
  function updateBank(field: keyof UpdateAgentBankDetailsInput, value: string) {
    setBankForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: [] }));
    setFeedback(null);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    const result = await agentProfileRepository.updateMine(
      user,
      form as UpdateAgentProfileInput & Record<string, unknown>,
    );
    setSaving(false);
    if (!result.ok) {
      setFieldErrors(result.error.fieldErrors ?? {});
      setFeedback({ tone: "error", message: result.error.message });
      return;
    }
    setSavedProfile({ ...result.data.profile });
    setForm({ ...result.data.profile });
    setEmailVerified(result.data.emailVerified);
    setFieldErrors({});
    setFeedback({
      tone: "success",
      message: result.data.emailVerified
        ? "Your profile changes have been saved."
        : "Your profile was saved. Verify your new email address before it is treated as verified.",
    });
  }
  async function saveBankDetails(event: React.FormEvent) {
    event.preventDefault();
    setBankSaving(true);
    setFeedback(null);
    const result = await agentProfileRepository.updateBankDetails(
      user,
      bankForm,
    );
    setBankSaving(false);
    if (!result.ok) {
      setFieldErrors(result.error.fieldErrors ?? {});
      setFeedback({ tone: "error", message: result.error.message });
      return;
    }
    const saved = result.data.bankDetails;
    const next = saved
      ? {
          bankName: saved.bankName,
          accountHolderName: saved.accountHolderName,
          accountNumber: saved.accountNumber,
        }
      : bankForm;
    setSavedBankDetails(next);
    setBankForm(next);
    setFieldErrors({});
    setFeedback({
      tone: "success",
      message: "Your payout bank details have been saved.",
    });
  }
  async function verifyNewEmail() {
    const result = await agentProfileRepository.verifyEmail(
      user,
      verificationCode,
    );
    if (!result.ok) {
      setFieldErrors(result.error.fieldErrors ?? {});
      setFeedback({ tone: "error", message: result.error.message });
      return;
    }
    setEmailVerified(true);
    setVerificationCode("");
    setFeedback({
      tone: "success",
      message: "Your new email address has been verified.",
    });
  }
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  useEffect(() => { setReferralLink(`${window.location.origin}/join/${profile.referralCode}`); }, [profile.referralCode]);
  async function sendVerification() { const result = await agentProfileRepository.requestEmailVerification(user); if (result.ok) { setVerificationSent(true); setFeedback({ tone: "success", message: "Verification instructions have been sent to your new email address." }); } else setFeedback({ tone: "error", message: result.error.message }); }
  async function copyReferral(value: string, kind: "link" | "code") { try { await navigator.clipboard.writeText(value); setCopiedReferral(kind); setTimeout(() => setCopiedReferral(null), 1800); } catch { setFeedback({ tone: "error", message: "The referral value could not be copied. Select it and copy it manually." }); } }
  return <><button className="profile-back-button" type="button" onClick={() => router.back()}><span aria-hidden="true">&lt;</span> Back to previous</button><div className="page-header profile-page-header"><div><p className="eyebrow">Account</p><h1>Your profile</h1><p className="page-description">Keep your personal contact details current and review your confirmed account record.</p></div></div>{pending && <PendingNotice profile={profile} />}{feedback && <div className={`profile-feedback profile-feedback-${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.message}</div>}<div className="profile-layout"><section className="panel profile-identity-panel"><div className="profile-identity"><Image className="profile-avatar profile-avatar-image" src={avatarSrc} alt="" width={64} height={64} unoptimized/><div><p className="eyebrow">{pending ? "Pending agent" : "Verified agent"}</p><h2>{profile.profile.fullName}</h2><p>{profile.profile.email}</p></div></div><div className="profile-status-stack"><span>Account <Badge status={profile.accountStatus} /></span><span>Email <Badge status={emailVerified ? "verified" : "pending_verification"} /></span><span>Registration <Badge status={profile.registrationStatus} /></span><span>Fee <Badge status={profile.feeStatus} /></span></div></section>{!pending && <section className="panel profile-form-panel"><div className="panel-header"><div><h2>Personal details</h2><p>Only your name, mobile number, and email address can be changed.</p></div></div><form className="profile-form" onSubmit={save} noValidate><ProfileField id="profile-full-name" label="Full name" value={form.fullName} onChange={(value) => update("fullName", value)} error={fieldErrors.fullName?.[0]} autoComplete="name"/><ProfileField id="profile-mobile" label="Mobile number" value={form.mobileNumber} onChange={(value) => update("mobileNumber", value)} error={fieldErrors.mobileNumber?.[0]} autoComplete="tel"/><ProfileField id="profile-email" label="Email address" value={form.email} onChange={(value) => update("email", value)} error={fieldErrors.email?.[0]} autoComplete="email" type="email"/>{emailChanged && <p className="profile-inline-note" role="status">Changing your email will require verification again before the new address is treated as verified.</p>}<div className="profile-form-actions"><Button type="submit" disabled={saving || !changed}>{saving ? "Saving changes..." : "Save changes"}</Button>{changed && <span>Unsaved changes</span>}</div></form>{!emailVerified && !emailChanged && <div className="profile-verification-panel"><p><strong>Verify your new email address</strong><span>Verification is required before this address is treated as verified.</span></p>{!verificationSent ? <Button variant="secondary" type="button" onClick={sendVerification}>Send verification email</Button> : <div className="profile-verification-form"><label htmlFor="profile-verification-code">Verification code</label><div><TextInput id="profile-verification-code" inputMode="numeric" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} placeholder="6-digit code"/><Button type="button" onClick={verifyNewEmail} disabled={verificationCode.trim().length !== 6}>Verify email</Button></div><small>Use the verification code from the email.</small></div>}</div>}</section>}{!pending && <section className="panel profile-form-panel"><div className="panel-header"><div><h2>Bank details</h2><p>These details are used for commission payouts.</p></div></div><form className="profile-form" onSubmit={saveBankDetails} noValidate><ProfileField id="profile-bank-name" label="Bank name" value={bankForm.bankName} onChange={(value) => updateBank("bankName", value)} error={fieldErrors.bankName?.[0]} autoComplete="off" options={MALAYSIAN_BANKS}/><ProfileField id="profile-account-holder" label="Account holder name" value={bankForm.accountHolderName} onChange={(value) => updateBank("accountHolderName", value)} error={fieldErrors.accountHolderName?.[0]} autoComplete="name"/><ProfileField id="profile-account-number" label="Bank account number" value={bankForm.accountNumber} onChange={(value) => updateBank("accountNumber", value)} error={fieldErrors.accountNumber?.[0]} autoComplete="off" inputMode="numeric"/><p className="profile-inline-note">Please confirm these details carefully. Future commission payouts will use this account.</p><div className="profile-form-actions"><Button type="submit" disabled={bankSaving || !bankChanged}>{bankSaving ? "Saving bank details..." : "Save bank details"}</Button>{bankChanged && <span>Unsaved changes</span>}</div></form></section>}<ReadOnlyDetails profile={profile} /><ReferralPanel referralCode={profile.referralCode} referralLink={referralLink} copied={copiedReferral} onCopy={copyReferral} /></div>{!pending && <section className="panel profile-actions-panel"><div><h2>Account access</h2><p>Password controls are handled separately from your profile details.</p></div><div className="profile-account-actions"><Link className="button button-secondary" href="/forgot-password">Change password <Icon name="arrow" size={14}/></Link></div></section>}</>;
}

function ProfileAccount({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const avatarSrc = createAvatar(avatarStyle, {
    seed: user.displayName,
    backgroundColor: ["d3edf1"],
    radius: 50,
    size: 128,
  }).toDataUri();
  const roleLabel = user.role === "staff" ? "Staff" : "Administrator";
  return (
    <>
      <button
        className="profile-back-button"
        type="button"
        onClick={() => router.back()}
      >
        <span aria-hidden="true">&lt;</span> Back to previous
      </button>
      <div className="page-header profile-page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Your profile</h1>
          <p className="page-description">
            Review your Smartegy account information.
          </p>
        </div>
      </div>
      <div className="profile-layout">
        <section className="panel profile-identity-panel">
          <div className="profile-identity">
            <Image
              className="profile-avatar profile-avatar-image"
              src={avatarSrc}
              alt=""
              width={64}
              height={64}
              unoptimized
            />
            <div>
              <p className="eyebrow">{roleLabel}</p>
              <h2>{user.displayName}</h2>
              <p>{user.email}</p>
            </div>
          </div>
        </section>
        <section className="panel profile-details-panel">
          <div className="panel-header">
            <div>
              <h2>Account record</h2>
              <p>These account details are managed by Smartegy.</p>
            </div>
          </div>
          <dl className="profile-detail-list">
            <ProfileDetail label="Full name" value={user.displayName} />
            <ProfileDetail
              label="Email address"
              value={user.email ?? "Not available"}
            />
            <ProfileDetail label="Role" value={roleLabel} />
          </dl>
        </section>
      </div>
      <AccountAccess />
    </>
  );
}

function AccountAccess() {
  return (
    <section className="panel profile-actions-panel">
      <div>
        <h2>Account access</h2>
        <p>
          Password controls are handled separately from your profile details.
        </p>
      </div>
      <div className="profile-account-actions">
        <Link className="button button-secondary" href="/forgot-password">
          Change password <Icon name="arrow" size={14} />
        </Link>
      </div>
    </section>
  );
}

function PendingNotice({ profile }: { profile: AgentProfile }) {
  const nextAction =
    profile.feeStatus === "rejected"
      ? "Resubmit your payment proof"
      : !profile.profileComplete
        ? "Complete your profile"
        : !profile.emailVerified
          ? "Verify your email"
          : profile.feeStatus === "pending_verification"
            ? "Await staff verification"
            : "Await staff approval";
  return (
    <div className="profile-pending-notice" role="status">
      <div>
        <strong>Your account is not active yet.</strong>
        <span>
          Access remains limited while Smartegy completes the registration
          checks.
        </span>
      </div>
      <span className="profile-next-action">
        Next action <b>{nextAction}</b>
      </span>
      <Link
        className="text-link"
        href="/onboarding/status?registrationId=registration-001"
      >
        View onboarding status <Icon name="arrow" size={14} />
      </Link>
    </div>
  );
}
function ReferralPanel({
  referralCode,
  referralLink,
  copied,
  onCopy,
}: {
  referralCode: string;
  referralLink: string;
  copied: "link" | "code" | null;
  onCopy: (value: string, kind: "link" | "code") => void;
}) {
  return (
    <section className="panel profile-referral-panel">
      <div className="panel-header">
        <div>
          <h2>Referral sharing</h2>
          <p>
            Share the sign-up link or give someone your code to enter manually.
          </p>
        </div>
      </div>
      <div className="profile-referral-body">
        <div className="profile-referral-field">
          <label htmlFor="referral-link">Sign-up link</label>
          <div>
            <TextInput id="referral-link" value={referralLink} readOnly />
            <button
              className="button button-secondary button-sm"
              type="button"
              onClick={() => onCopy(referralLink, "link")}
            >
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
        <div className="profile-referral-field">
          <label htmlFor="referral-code">Referral code</label>
          <div>
            <TextInput id="referral-code" value={referralCode} readOnly />
            <button
              className="button button-secondary button-sm"
              type="button"
              onClick={() => onCopy(referralCode, "code")}
            >
              {copied === "code" ? "Copied" : "Copy code"}
            </button>
          </div>
          <small>
            Use this code when completing the referral field manually.
          </small>
        </div>
      </div>
    </section>
  );
}
function ReadOnlyDetails({ profile }: { profile: AgentProfile }) {
  return (
    <section className="panel profile-details-panel">
      <div className="panel-header">
        <div>
          <h2>Account record</h2>
          <p>
            These values are controlled by Smartegy and cannot be edited here.
          </p>
        </div>
      </div>
      <dl className="profile-detail-list">
        <ProfileDetail label="Agent number" value={profile.agentNumber} />
        <ProfileDetail
          label="Application number"
          value={profile.applicationNumber}
        />
        <ProfileDetail
          label="Joined date"
          value={formatDate(profile.joinedDate)}
        />
        <ProfileDetail
          label="Agent level"
          value={`Level ${profile.currentLevel}`}
        />
        <ProfileDetail
          label="Confirmed upline"
          value={profile.uplineName ?? "Direct registration"}
        />
        <ProfileDetail
          label="Profile completion"
          value={profile.profileComplete ? "Complete" : "Incomplete"}
        />
      </dl>
    </section>
  );
}
function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function ProfileField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  type = "text",
  inputMode,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: string;
  type?: string;
  inputMode?:
    | "numeric"
    | "text"
    | "email"
    | "tel"
    | "decimal"
    | "search"
    | "url"
    | "none";
  options?: readonly string[];
}) {
  return (
    <div className={`profile-field ${error ? "profile-field-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {options ? (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <option value="">Select a bank</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <TextInput
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
