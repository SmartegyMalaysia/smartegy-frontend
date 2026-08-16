"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDate, formatMoney } from "@/lib/format";
import { casesRepository } from "@/lib/case-repository";
import { usePreviewUser } from "@/lib/preview-user";
import type { CaseDetail } from "@/lib/types";

export default function CaseDetailPage() {
  const { user: agent } = usePreviewUser("agent");
  const params = useParams<{ caseId: string }>();
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [state, setState] = useState<"loading" | "error" | "permission">("loading");
  useEffect(() => { casesRepository.getById(agent, params.caseId).then((result) => { if (result.ok) { setCaseDetail(result.data); setState("loading"); } else setState(result.error.code === "FORBIDDEN" ? "permission" : "error"); }); }, [agent, params.caseId]);
  return <AppShell user={agent} onRoleChange={() => undefined}><main className="page-content case-detail-page">{state === "loading" && !caseDetail ? <LoadingState /> : state === "permission" ? <ErrorState onRetry={() => setState("loading")} /> : state === "error" || !caseDetail ? <ErrorState onRetry={() => setState("loading")} /> : <><Link className="back-link" href="/dashboard"><Icon name="arrow" size={14} /> Back to dashboard</Link><div className="case-detail-header"><div><p className="eyebrow">Case detail</p><h1>{caseDetail.caseNumber}</h1><p className="page-description">{caseDetail.customer.displayName}</p></div><Badge status={caseDetail.status} /></div><div className="login-message login-message-info" role="status"><span>✓</span><div>This case has been submitted for staff review. Review normally takes 1–3 business days.</div></div><div className="case-detail-grid"><section className="panel case-form-panel"><div className="panel-header"><div><h2>Customer Details</h2><p>Submitted {formatDate(caseDetail.submittedAt)}</p></div></div><dl className="case-detail-list"><div><dt>Company Name</dt><dd>{caseDetail.customer.displayName}</dd></div><div><dt>Company Email Address</dt><dd>{caseDetail.customer.email ?? "Not provided"}</dd></div><div><dt>Contact Person Name</dt><dd>{caseDetail.customer.contactName ?? "Not provided"}</dd></div><div><dt>Contact Person Phone Number</dt><dd>{caseDetail.customer.phone ?? "Not provided"}</dd></div><div><dt>Service Address</dt><dd>{caseDetail.service.siteAddress || "Not provided"}</dd></div><div><dt>Additional Remarks</dt><dd>{caseDetail.service.notes ?? "Not provided"}</dd></div></dl></section><section className="panel case-form-panel"><div className="panel-header"><div><h2>Documents</h2><p>Files available to authorised reviewers.</p></div></div><div className="case-detail-documents">{caseDetail.documents.map((document) => <div className="case-detail-document" key={document.id}><div><strong>{document.fileName}</strong><span>{document.type === "electricity_bill" ? "Latest electricity bill" : "Supporting document"} · {Math.ceil(document.sizeBytes / 1024)} KB</span></div><span className="case-document-state">Uploaded</span></div>)}</div></section></div><section className="panel case-form-panel"><div className="panel-header"><div><h2>Activity</h2><p>Submission history</p></div></div><div className="case-detail-activity">{caseDetail.activity.map((event) => <div key={event.id}><span className="case-activity-dot" aria-hidden="true" /><div><strong>{event.summary}</strong><span>{event.actorDisplayName} · {formatDate(event.occurredAt)}</span></div></div>)}</div></section></>}</main></AppShell>;
}
