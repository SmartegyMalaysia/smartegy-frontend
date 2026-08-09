"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "./app-shell";
import { Badge, LoadingState, PermissionDenied } from "./ui";
import { registrationRepository } from "@/lib/registration-repository";
import type { AgentRegistration, CurrentUser } from "@/lib/types";

function actorFor(registrationId: string): CurrentUser { return { id: `user-${registrationId}`, role: "agent", displayName: "New applicant", email: null, agentId: registrationId }; }

export function RegistrationStatusPage() {
  const params = useSearchParams();
  const registrationId = params.get("registrationId") ?? "";
  const actor = useMemo(() => actorFor(registrationId), [registrationId]);
  const [registration, setRegistration] = useState<AgentRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { registrationRepository.getRegistration(actor, registrationId).then((result) => result.ok && setRegistration(result.data)).finally(() => setLoading(false)); }, [actor, registrationId]);
  if (loading) return <AppShell user={actor} onRoleChange={() => undefined}><div className="page-content"><LoadingState /></div></AppShell>;
  if (!registration) return <AppShell user={actor} onRoleChange={() => undefined}><div className="page-content"><PermissionDenied /></div></AppShell>;
  const active = registration.registrationStatus === "active";
  return <AppShell user={actor} onRoleChange={() => undefined}><div className="page-content"><section className="panel status-panel"><div className="status-panel-icon">{active ? "✓" : "i"}</div><p className="eyebrow">Registration status</p><h1>{active ? "Your agent account is active" : "Your registration is being reviewed"}</h1><p>{active ? "All requirements are complete. You can now access the active agent workspace." : "Payment submitted and pending staff verification. Your account will be activated after your registration and payment have been approved."}</p><div className="status-summary"><span>Registration <Badge status={registration.registrationStatus} /></span><span>Fee <Badge status={registration.feeStatus} /></span><span>Email <Badge status={registration.emailVerified ? "verified" : "pending_verification"} /></span><span>Profile <Badge status={registration.profileComplete ? "verified" : "draft"} /></span></div>{registration.feeStatus === "rejected" && <div className="login-message login-message-error" role="alert"><span aria-hidden="true">!</span>{registration.rejectionReason}</div>}{active && <Link className="button button-primary" href="/dashboard">Open agent workspace</Link>}</section></div></AppShell>;
}
