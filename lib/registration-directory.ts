import type { AgentRegistration, RegistrationQueueQuery } from "./types";

export function sortRegistrationDirectory(items: AgentRegistration[], sort: RegistrationQueueQuery["sort"] = "priority") {
  const priority = (item: AgentRegistration) => item.feeStatus === "pending_verification" ? 0 : item.registrationStatus === "pending_approval" ? 1 : 2;
  return [...items].sort((a, b) => {
    let comparison = 0;
    if (sort === "priority") comparison = priority(a) - priority(b) || b.updatedAt.localeCompare(a.updatedAt);
    else if (sort === "oldest") comparison = (a.submittedAt ?? a.createdAt).localeCompare(b.submittedAt ?? b.createdAt);
    else if (sort === "fee_status") comparison = a.feeStatus.localeCompare(b.feeStatus) || b.updatedAt.localeCompare(a.updatedAt);
    else if (sort === "recently_updated") comparison = b.updatedAt.localeCompare(a.updatedAt);
    else comparison = (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt);
    return comparison || a.applicationNumber.localeCompare(b.applicationNumber);
  });
}
