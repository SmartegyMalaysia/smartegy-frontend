import type { UserRole } from "./types";

export interface HelpSection {
  id: string;
  title: string;
  paragraphs?: string[];
  steps?: string[];
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  note?: string;
  details?: boolean;
  flow?: Array<{ label: string; description?: string; icon?: string }>;
  flowColumns?: 3 | 4;
  moneyCards?: Array<{ label: string; amount: string; note?: string }>;
  image?: { src: string; alt: string; caption: string; width: number; height: number };
}

export interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
  roles: UserRole[];
  sections: HelpSection[];
  relatedHref?: string;
  relatedLabel?: string;
  icon?: string;
  taskLabel?: string;
  featured?: boolean;
}

export const HELP_REVISION = "29 September 2026";

const allRoles: UserRole[] = ["agent", "staff", "admin"];
const staffRoles: UserRole[] = ["staff", "admin"];

const articles: HelpArticle[] = [
  {
    id: "getting-started", title: "Getting started", summary: "Sign in, find your work, and keep your account details current.", category: "Account", roles: allRoles,
    icon: "grid", taskLabel: "Start here", featured: true, relatedHref: "/dashboard", relatedLabel: "Open Dashboard",
    sections: [
      { id: "navigation", title: "Find your pages", details: true, paragraphs: ["Use the left menu to open a page. On a small screen, tap Menu. Your links depend on your role and account status."] },
      { id: "profile", title: "Update your profile", details: true, steps: ["Open the account menu and choose Your Profile.", "Update the fields your role can change.", "Save your changes. If you change your email, verify the new address.", "Use password reset if you cannot sign in."] },
      { id: "statuses", title: "Read statuses", details: true, paragraphs: ["A status shows the record's current state. Open the record for details and next steps. A payment marked Pending has not been verified yet."] },
    ],
  },
  {
    id: "agent-registration", title: "Complete agent registration", summary: "Verify your email and send proof of the RM50 registration fee.", category: "Account", roles: ["agent"],
    icon: "file", taskLabel: "Finish registration", relatedHref: "/onboarding/status", relatedLabel: "Check application status",
    sections: [
      { id: "registration", title: "Register and submit proof", steps: ["Open your invitation link. Enter your profile and referral code.", "Enter the one-time code sent to your email.", "Transfer the RM50 non-refundable name-card fee. Use your application number as the reference.", "Follow the bank instructions shown. Enter the requested details and upload payment proof.", "Save your application number and check your status while staff review the proof."], note: "The portal records proof for staff review. It does not make the bank transfer or issue a fee receipt. A verified fee, verified email, and complete profile are needed for automatic approval and activation." },
      { id: "registration-pending", title: "If your application is pending", paragraphs: ["Open your profile or onboarding status. If staff reject the proof, read the reason and follow the resubmission steps. Contact the portal administrator with your application number if you need help."] },
    ],
  },
  {
    id: "agent-cases", title: "Submit and follow a case", summary: "Add a customer case, send documents, and complete each case action.", category: "Cases", roles: ["agent"],
    icon: "folder", taskLabel: "Submit a case", featured: true, relatedHref: "/dashboard", relatedLabel: "Open Dashboard",
    sections: [
      { id: "submit", title: "Submit a case", steps: ["From Dashboard, choose Submit New Case.", "Enter the customer name and business type. If you choose Other, add a description.", "Upload the electricity bill. Supporting documents are optional.", "Check the details and submit. The case moves to review."], image: { src: "/help/submit-case.jpg", alt: "Dashboard with the Submit New Case button marked 1.", caption: "Example screen. Marker 1 shows Submit New Case.", width: 612, height: 111 } },
      { id: "case-flow", title: "Case stages", flowColumns: 3, flow: [
        { label: "Customer details", description: "Submit the case." },
        { label: "Review and quote", description: "Staff prepare a proposal." },
        { label: "Downpayment", description: "Accept and sign the proposal." },
        { label: "Installation", description: "Confirm the proposed date." },
        { label: "Post-installation", description: "Record payment and savings." },
        { label: "Recurring balance", description: "Record scheduled payments." },
      ] },
      { id: "case-actions", title: "Complete case actions", details: true, steps: ["When staff issue a proposal, choose Accept Proposal and submit the signed proposal.", "Choose Record Downpayment. Enter the transfer and proof. Wait for staff to verify it.", "Choose Confirm Installation Date, or request a new date if needed.", "After installation, choose Record Post-Installation Payment. Submit the details and proof. Wait for staff to verify it.", "After verification, choose Record Savings. Enter exactly three unique completed months.", "When installments start, choose Record Installment Payment for each customer payment. Check the schedule status."] },
      { id: "changes", title: "Make requested changes", steps: ["Open the case activity and read the request.", "Update the details or document.", "Choose Resubmit for Review."] },
    ],
  },
  {
    id: "agent-referral-sharing", title: "Share your referral link", summary: "Copy your referral link or code from Your Profile.", category: "Agents", roles: ["agent"],
    icon: "users", taskLabel: "Share a referral", relatedHref: "/settings/profile", relatedLabel: "Open Your Profile",
    sections: [
      { id: "share", title: "Copy your link or code", steps: ["Open Your Profile from the account menu.", "Use Copy link or Copy code in the referral panel.", "Share the link, or ask the person to enter your code when they register."], image: { src: "/help/referral-link.jpg", alt: "Referral panel with Copy link marked 1 and Copy code marked 2.", caption: "Example screen. Marker 1 copies the sign-up link. Marker 2 copies the referral code.", width: 860, height: 206 }, note: "The portal does not promise a cash reward just for signing up. Any commission depends on the applicable rules and your commission record." },
    ],
  },
  {
    id: "referral-mechanics", title: "How referrals work", summary: "See how referral codes link agents and how the portal tracks results.", category: "Agents", roles: allRoles,
    icon: "users",
    sections: [
      { id: "referral-flow", title: "Referral path", flow: [
        { label: "Share link or code", description: "An agent shares a profile referral." },
        { label: "Register", description: "The new agent enters the code." },
        { label: "Link accounts", description: "The agent who invited them is shown as their upline." },
        { label: "Track results", description: "The Agents view shows permitted activity." },
      ] },
      { id: "referral-details", title: "Referral details", details: true, bullets: ["A referral link connects an application to the agent who invited them.", "The Agents view may show direct agents, successful cases, and sales.", "The upline (agent who invited them) appears in the referral record.", "A referral link alone does not promise payment. Check the commission record for details."] },
    ],
  },
  {
    id: "commission-explainer", title: "Understand commissions", summary: "See how commissions are worked out, approved, and paid.", category: "Commissions", roles: allRoles,
    icon: "wallet", taskLabel: "View commission details", featured: true, relatedHref: "/commissions", relatedLabel: "Open My Commissions",
    sections: [
      { id: "commission-flow", title: "How commission payments work", paragraphs: ["Staff must check the post-installation payment at Stage 5 before the first amount is ready. A bank transfer happens separately."], flow: [
        { label: "Customer pays", description: "A customer payment is recorded." },
        { label: "Staff checks payment", description: "Staff verify the post-installation payment at Stage 5." },
        { label: "Ready for payment", description: "The first amount is ready after Stage 5." },
        { label: "Paid", description: "Staff record the bank transfer." },
      ] },
      { id: "commission-overview", title: "Check your commission", paragraphs: ["Open a commission record. Check your total, first amount, amount paid, and dates there. Dates can vary by record."], details: true, bullets: ["Agents can open My Commissions. Staff and admins can review commission records from Payouts.", "The calculator is an example. Your actual commission record may differ."] },
      { id: "worked-example", title: "Try a commission example", paragraphs: ["Enter a project value, add people and their agent levels, and choose who referred each person. Select who made the sale to see each person's cuts and total."], note: "Example only. The calculator treats the people you enter as active agents. It does not create a payment." },
      { id: "commission-calculation", title: "How is this calculated?", details: true, paragraphs: ["Each cut is a percentage of the project value before financing interest. Only the seller and eligible people above them in the referral chain receive cuts.", "A Level 2 seller receives the Level 1 and Level 2 cuts. A Level 3 seller receives all three cuts. For a Level 1 seller, the first referrer at Level 2 or 3 receives the Level 2 cut. If that person is Level 3, they also receive the Level 3 cut. Otherwise, the calculator looks above that person for the first Level 3 referrer.", "First payment and later payment amounts also depend on customer payments. Project value alone cannot work out those amounts. Check your actual commission record for payment details."], table: { headers: ["Cut", "Percent of project value"], rows: [["Level 1", "5.5%"], ["Level 2", "3.0%"], ["Level 3", "1.5%"]] } },
      { id: "commission-status", title: "Commission statuses", details: true, table: { headers: ["Status", "Meaning"], rows: [["Calculated", "Worked out, not yet approved."], ["Scheduled", "Planned for a payment date."], ["Approved", "Cleared for payment."], ["Paid", "Bank payment recorded."], ["Withheld", "On hold; check the reason."], ["Adjusted", "Changed with a recorded reason."], ["Reversed", "Cancelled after a recorded correction."]] }, note: "The portal records payments. It does not send the bank transfer." },
      { id: "commission-help", title: "If a number looks wrong", details: true, steps: ["Open the record and note its case number.", "Ask the staff member responsible for commissions to review it."] },
    ],
  },
  {
    id: "agent-bank-details", title: "Add payout bank details", summary: "Save the bank account used for your commission payouts.", category: "Account", roles: ["agent"],
    icon: "wallet", relatedHref: "/settings/profile", relatedLabel: "Open Your Profile",
    sections: [
      { id: "bank-details", title: "Save bank details", steps: ["Open Your Profile.", "Enter your bank name, account holder name, and account number.", "Check the details and choose Save bank details."] , image: { src: "/help/bank-details.jpg", alt: "Bank details form with Save bank details button marked 1.", caption: "Example screen. Marker 1 saves your bank details.", width: 292, height: 518 }, note: "Adding details does not send or settle a payment." },
    ],
  },
  {
    id: "case-documents-payments", title: "Documents and payments", summary: "Upload case documents and follow customer payments.", category: "Cases", roles: allRoles,
    icon: "file",
    sections: [
      { id: "case-progress", title: "Check case progress", steps: ["Open the case from Dashboard, or from Cases if that page is available to your role.", "Read the current status and recent activity.", "Follow the next action shown on the case."] },
      { id: "documents", title: "Find case documents", bullets: ["Open Documents on the case. Files appear by date.", "Use Preview when available.", "Quotations and invoices open as DOCX. Existing receipts may be viewable.", "The portal does not create a receipt for each payment."] },
      { id: "customer-payments", title: "Record or verify a payment", steps: ["Open the case and choose the payment action shown.", "To record a payment, enter its amount, date, reference, and proof if requested.", "To verify one, review its proof. Choose the unpaid bill and enter the amount received.", "Check the payment and schedule status."], note: "Agents record payments on their own cases. Staff and admins review and verify them." },
      { id: "payment-status", title: "Payment status", details: true, table: { headers: ["Status", "Meaning"], rows: [["Pending verification", "Waiting for staff review."], ["Rejected", "Read the reason and follow the case action."], ["Verified", "Accepted and linked to a schedule."]] } },
    ],
  },
  {
    id: "account-support", title: "Account and support", summary: "Quick answers for access, payments, and getting help.", category: "Support", roles: allRoles,
    icon: "question",
    sections: [
      { id: "support-faq", title: "Common questions", details: true, table: { headers: ["Question", "Answer"], rows: [["I cannot see a page.", "Your role or account status may limit access. Ask an administrator if you need access."], ["A payment is pending.", "It is waiting for staff review."], ["How do I change my password?", "Use password reset from the sign-in page."], ["Where do I get help?", "Contact your portal administrator or the staff member responsible for the case. Include its reference. Never send a password or full bank details."]] } },
    ],
  },
  {
    id: "operations-workflows", title: "Review cases", summary: "Prepare proposals, verify payments, and move cases forward.", category: "Operations", roles: staffRoles,
    icon: "folder", taskLabel: "Open cases", featured: true, relatedHref: "/cases", relatedLabel: "Open Cases",
    sections: [
      { id: "case-review", title: "Review and progress a case", details: true, steps: ["Open Cases. Find and open the case.", "Check customer details, the electricity bill, and case activity.", "For a case under review, choose Prepare Proposal or Request Changes. Give a reason for requested changes.", "Review payment proof. Choose the unpaid bill and enter the amount received.", "Set or update the installation date. Record installation after the work is complete.", "After installation, the case owner enters three completed monthly readings. When available, choose Start Recurring Balance and set the first date and 10- or 20-month customer term.", "Check the activity and status after each action."], note: "Available actions depend on the case status and your role." },
      { id: "case-docs", title: "Create an invoice", steps: ["Open the case payment schedule.", "Choose Generate Invoice beside an available schedule item.", "Open the DOCX from the Documents list."] , note: "A schedule amount can be paid in more than one payment. Use the remaining balance shown." },
    ],
  },
  {
    id: "operations-registrations", title: "Review registrations and agents", summary: "Check fee proofs, agent details, and qualification requests.", category: "Operations", roles: staffRoles,
    icon: "users", taskLabel: "Review a registration", relatedHref: "/registrations", relatedLabel: "Open Registrations",
    sections: [
      { id: "registrations", title: "Review a registration", steps: ["Open Registrations. Search or filter the queue.", "Check the profile and RM50 proof. Applicants use their application number as the transfer reference.", "Verify the transfer or reject it with a reason.", "A verified fee, verified email, and complete profile trigger automatic approval and activation. Otherwise the application stays pending."] , note: "The portal records manual verification. It does not transfer money or issue a fee receipt." },
      { id: "agents", title: "Review an agent", paragraphs: ["Open Agents to check an agent's upline, cases, sales, and qualification progress. A progress indicator does not approve a level change."] },
    ],
  },
  {
    id: "operations-payouts", title: "Reconcile payouts", summary: "Review monthly payments and record external bank settlements.", category: "Operations", roles: staffRoles,
    icon: "wallet", taskLabel: "Review payouts", relatedHref: "/payouts", relatedLabel: "Open Payouts",
    sections: [
      { id: "payout-process", title: "Mark a payout settled", steps: ["Choose a month. Search or filter for the transaction.", "Check the agent, case, amount, commission status, and bank details.", "After the bank payment is made, choose Mark Settled for an eligible transaction.", "Enter the bank reference and save."] , note: "Mark Settled records an external payment; it does not send money." },
      { id: "payout-status", title: "Read payout status", details: true, bullets: ["Scheduled entries are for planning.", "Only approved entries with bank details can be marked settled.", "Exports use your current filters."] },
    ],
  },
  {
    id: "admin-approvals", title: "Approve level changes", summary: "Review requests and record an approval decision.", category: "Administration", roles: ["admin"],
    icon: "check", taskLabel: "Review approvals", relatedHref: "/approvals", relatedLabel: "Open Approvals",
    sections: [
      { id: "approval-review", title: "Review a request", steps: ["Open Approvals and choose a pending request.", "Check the agent, requested level, progress, and request history.", "Approve or reject the request. Add the reason or note requested.", "Check the updated status and history."], note: "Progress does not approve a request by itself. Ask the policy owner if a rule is unclear." },
    ],
  },
  {
    id: "admin-users", title: "Manage users", summary: "Invite staff and review user access.", category: "Administration", roles: ["admin"],
    icon: "user-settings", taskLabel: "Manage users", relatedHref: "/users", relatedLabel: "Open Users",
    sections: [
      { id: "invite-staff", title: "Invite a staff member", steps: ["Open Users and choose the invite action.", "Enter the staff member's name, email, and phone.", "Send the invitation.", "Check the account state in Users after setup."] , note: "The invitation sets the staff email and role. They cannot change these during setup." },
      { id: "access", title: "Change user access", steps: ["Open the intended user.", "Check the user's identity, role, and status.", "Make the needed change and confirm it."] },
    ],
  },
];

const validRoles = new Set<UserRole>(["agent", "staff", "admin"]);

export function getHelpArticles(role: UserRole): HelpArticle[] {
  if (!validRoles.has(role)) return [];
  return articles.filter((article) => article.roles.includes(role)).map((article) => ({
    ...article,
    title: titleCase(article.title),
    ...(article.id === "commission-explainer" && role !== "agent" ? { relatedHref: "/payouts", relatedLabel: "Open Payouts" } : {}),
    sections: article.sections.map((section) => ({ ...section, title: titleCase(section.title) })),
  }));
}

export function searchHelpArticles(visibleArticles: HelpArticle[], query: string): HelpArticle[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return visibleArticles;
  return visibleArticles.filter((article) => {
    const text = [article.title, article.summary, article.category, article.taskLabel ?? "", ...article.sections.flatMap((section) => [
      section.title, ...(section.paragraphs ?? []), ...(section.steps ?? []), ...(section.bullets ?? []), section.note ?? "",
      ...(section.table?.headers ?? []), ...(section.table?.rows.flat() ?? []),
      ...(section.flow?.flatMap((item) => [item.label, item.description ?? "", item.icon ?? ""]) ?? []),
      ...(section.moneyCards?.flatMap((card) => [card.label, card.amount, card.note ?? ""]) ?? []),
      ...(section.image ? [section.image.alt, section.image.caption] : []),
    ])].join(" ").toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

function titleCase(value: string): string {
  const smallWords = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "or", "over", "per", "the", "to", "up", "via", "with", "yet"]);
  return value.toLocaleLowerCase().split(" ").map((word, index) => {
    if (index > 0 && smallWords.has(word)) return word;
    return word.replace(/(^|[-:])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`);
  }).join(" ");
}
