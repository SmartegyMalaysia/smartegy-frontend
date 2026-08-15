"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge, ErrorState, LoadingState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDate, formatMoney } from "@/lib/format";
import { agentCommissionsRepository } from "@/lib/commission-repository";
import type { AgentCommissionRecord, CurrentUser } from "@/lib/types";

const agent: CurrentUser = { id: "user-001", role: "agent", displayName: "Aisha Rahman", email: "aisha@smartegy.example", agentId: "agent-001" };

export default function CommissionDetailPage() {
  const params = useParams<{ commissionId: string }>();
  const [record, setRecord] = useState<AgentCommissionRecord | null>(null);
  const [state, setState] = useState<"loading" | "error" | "permission">("loading");
  useEffect(() => { agentCommissionsRepository.getById(agent, params.commissionId).then((result) => { if (result.ok) { setRecord(result.data); setState("loading"); } else setState(result.error.code === "FORBIDDEN" ? "permission" : "error"); }); }, [params.commissionId]);
  return <AppShell user={agent} onRoleChange={() => undefined}><main className="page-content commission-detail-page">{state === "loading" && !record ? <LoadingState/> : state === "permission" ? <ErrorState/> : state === "error" || !record ? <ErrorState/> : <CommissionDetail record={record}/>}</main></AppShell>;
}

function CommissionDetail({ record }: { record: AgentCommissionRecord }) {
  return <><Link className="back-link" href="/commissions"><span aria-hidden="true">&lt;</span> My Commissions</Link><div className="commission-detail-header"><div><p className="eyebrow">Commission detail</p><h1>{record.caseNumber}</h1><p className="page-description">{record.customerDisplayName} · {record.commissionNumber}</p></div><Badge status={record.status}/></div><div className="commission-detail-notice" role="status"><strong>{record.eligibilityStatus === "eligible" ? "Eligible commission" : "Commission pending eligibility"}</strong><span>{record.eligibilityStatus === "eligible" ? "This record was returned by the trusted commission service." : "This commission is not yet eligible for payout."}</span></div><div className="commission-detail-summary"><DetailMetric label="My entitlement" value={formatMoney(record.entitlementSen)}/><DetailMetric label="First payment" value={formatMoney(record.firstPaymentSen)}/><DetailMetric label="Paid to date" value={formatMoney(record.paidToDateSen)}/><DetailMetric label="Remaining balance" value={formatMoney(record.deferredBalanceSen)}/></div>{record.withheldReason && <div className="commission-detail-note commission-detail-note-warning"><strong>Withheld reason</strong><span>{record.withheldReason}</span></div>}{record.adjustmentNote && <div className="commission-detail-note"><strong>Adjustment note</strong><span>{record.adjustmentNote}</span></div>}<div className="commission-detail-grid"><section className="panel commission-detail-panel"><div className="panel-header"><div><h2>Payment information</h2><p>Trusted payment and eligibility information</p></div></div><dl className="commission-detail-list"><div><dt>Eligibility</dt><dd>{record.eligibilityStatus === "eligible" ? "Eligible" : "Pending"}</dd></div><div><dt>Qualifying payment</dt><dd>{record.qualifyingPaymentDate ? formatDate(record.qualifyingPaymentDate) : "Not available"}</dd></div><div><dt>Last updated</dt><dd>{formatDate(record.lastUpdatedAt)}</dd></div><div><dt>Record status</dt><dd><Badge status={record.status}/></dd></div></dl></section><section className="panel commission-detail-panel"><div className="panel-header"><div><h2>First payment</h2><p>Separate from the deferred 17-month schedule</p></div></div><div className="commission-first-payment"><strong>{formatMoney(record.firstPaymentSen)}</strong><span>Recorded paid amount: {formatMoney(record.paidToDateSen)}</span></div></section></div><section className="panel commission-schedule-panel"><div className="panel-header"><div><h2>17-month payment schedule</h2><p>Every instalment is returned by the trusted commission service.</p></div><span className="case-count">{record.schedule.length} instalments</span></div><div className="table-wrap"><table className="commission-schedule-table"><caption className="sr-only">17-month payment schedule</caption><thead><tr><th scope="col">Month</th><th scope="col">Scheduled date</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Actual payment</th><th scope="col">Reference / note</th></tr></thead><tbody>{record.schedule.map((entry) => <tr key={entry.id}><td>Month {entry.sequence}</td><td>{formatDate(entry.dueDate)}</td><td className="commission-money">{formatMoney(entry.amountSen)}</td><td><Badge status={entry.status}/></td><td>{entry.paidAt ? formatDate(entry.paidAt) : <span className="muted-cell">Not paid</span>}</td><td>{entry.paymentReference ?? entry.note ?? <span className="muted-cell">—</span>}</td></tr>)}</tbody></table></div></section></>;
}

function DetailMetric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
