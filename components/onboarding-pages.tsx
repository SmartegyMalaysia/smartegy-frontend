"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, LoadingState, PermissionDenied } from "./ui";
import { registrationRepository } from "@/lib/registration-repository";
import { usePreviewUser } from "@/lib/preview-user";
import type { AgentRegistration } from "@/lib/types";

export function RegistrationStatusPage() {
  const { user, ready } = usePreviewUser();
  const [registration, setRegistration] = useState<AgentRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    registrationRepository.getRegistration(user, "").then((result) => result.ok && setRegistration(result.data)).finally(() => setLoading(false));
  }, [ready, user]);
  if (!ready || loading) return <div className="page-content"><LoadingState /></div>;
  if (!registration) return <div className="page-content"><PermissionDenied /></div>;
  const active = registration.registrationStatus === "active";
  return <div className="page-content"><section className="panel status-panel"><div className="status-panel-icon">{active ? "✓" : "i"}</div><p className="eyebrow">Registration status</p><h1>{active ? "Your Agent Account Is Active" : "Your Registration Is Being Reviewed"}</h1><p>{active ? "All requirements are complete. You can now access the active agent workspace." : "Your registration and payment proof are awaiting administrator verification. You will be able to submit cases once your account has been activated."}</p><div className="status-summary"><span>Registration <Badge status={registration.registrationStatus} /></span><span>Fee <Badge status={registration.feeStatus} /></span><span>Email <Badge status={registration.emailVerified ? "verified" : "pending_verification"} /></span><span>Profile <Badge status={registration.profileComplete ? "verified" : "draft"} /></span></div>{registration.feeStatus === "rejected" && <div className="login-message login-message-error" role="alert"><span aria-hidden="true">!</span>{registration.rejectionReason}</div>}{active && <Link className="button button-primary" href="/dashboard">Open Agent Workspace</Link>}</section></div>;
}
