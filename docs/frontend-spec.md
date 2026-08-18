# Smartegy Frontend Specification

## 1. Experience Direction

Smartegy should feel like a trustworthy, efficient B2B operations product: clear hierarchy, restrained colour, compact tables, and prominent status information. Use the following as visual inspiration, not as a screen to copy:

- https://dribbble.com/shots/25812342-SAAS-Category-Table-Dashboard-Page-UI-UX

The admin portal can be information-dense. The agent portal should be simpler, with fewer controls and stronger emphasis on personal cases, commissions, and progress.

Use the `interface-design` skill and `.interface-design/system.md` for implementation and review.

### Implementation Conventions

- Prefer the Tailwind CSS color palette for general UI styling and states, using named shades such as `slate-800` (`#1e293b`) and `sky-400` (`#38bdf8`) when a CSS literal is required. Avoid arbitrary one-off colors.
- Use Smartegy-specific colors such as `--brand`, `--brand-green`, and their related tokens only when the color is intentionally part of Smartegy's brand or a defined semantic state. Do not use the green brand color as a generic active-navigation treatment.
- Sidebar navigation uses a white active card with a 14–16px radius, a Tailwind `slate-200` border, and a very subtle raised shadow. Active icon and label use Smartegy brand green at roughly 600 weight. Inactive hover uses a full-row Tailwind `slate-100` background without border or shadow, and must never override the active route styling.
- UI titles, page headings, section headings, dialog titles, and primary action labels must use **Camel Case / Title Case**: capitalise the meaningful words in the title (for example, `Commission Payouts`, `Transaction Reconciliation`, and `Mark Settled`). Do not use sentence case for titles.
- Reuse the existing shared components for UI elements. Do not add a native HTML/React element directly in a page when an equivalent project component exists (for example, use the shared `Button`, `TextInput`, `Badge`, `DataTable`, `Toast`, or `EmptyState` components).
- If an equivalent component does not exist, create a reusable component in the shared components directory first. Use that new component on the current page and make future pages reuse it; do not create page-specific duplicates of the same UI pattern.
- When adding a component, follow the existing component API, styling tokens, accessibility behavior, and state patterns so the component becomes the canonical implementation for that UI pattern.

## 2. Global Application Structure

### Primary Navigation

- Dashboard
- Cases
- Agents
- Users (Admin)
- Commissions
- Invoices & Receipts
- Reports
- Settings

Navigation is permission-aware. Agents should not see administrative destinations they cannot use.

### App Shell

- Collapsible desktop sidebar.
- Mobile navigation drawer.
- Header with page title, optional contextual action, notifications placeholder only if in scope, and user menu.
- Breadcrumbs on detail pages where they improve orientation.
- Consistent main-content width, page spacing, and responsive gutters.

### Global Utilities

- Search only where the underlying endpoint supports it.
- Filters are reflected in the URL when practical so views can be refreshed or shared.
- Toasts acknowledge completed non-destructive actions.
- Inline messages explain validation or recoverable errors.
- Confirmation dialogs protect destructive, irreversible, and financial actions.

## 3. Route Map

Proposed route structure; adjust to the actual Next.js architecture without changing the product meaning.

| Route | Page | Main roles |
|---|---|---|
| `/join/[code]` | Invitation/referral-based registration, OTP verification, and payment proof | Public/invited applicant |
| `/forgot-password` | Request password-reset instructions | Public |
| `/reset-password` | Set a new password from a valid reset session | Public/reset session |
| `/onboarding/status` | Registration and fee status | Pending agent |
| `/dashboard` | Role-aware dashboard | All |
| `/cases` | Case list | All, permission-filtered |
| `/cases/new` | New case form | Agent, Staff, Admin |
| `/cases/[caseId]` | Case detail | All, permission-filtered |
| `/agents` | Agent list | Staff, Admin |
| `/agents/[agentId]` | Agent profile and referral details | Permitted users |
| `/users` | Admin user directory and account access management | Admin |
| `/registrations` | Registration and RM50 fee-verification queue | Staff, Admin |
| `/commissions` | Commission list | All, permission-filtered |
| `/commissions/[commissionId]` | Commission breakdown and schedule | Permitted users |
| `/documents` | Invoice and receipt list | Staff, Admin |
| `/reports` | Reports and exports | Staff, Admin |
| `/settings/profile` | User profile | All |
| `/settings/agents` | Agent/level configuration where approved | Staff, Admin |

## 4. Shared Page Patterns

### List Pages

Use this order:

1. Page title and primary action.
2. Small set of meaningful summary values only when useful.
3. Search, filters, date range, and export controls.
4. Results table.
5. Pagination and result count.

Requirements:

- Sortable columns only when sorting is supported.
- Visible active filters and a clear reset action.
- Row action menu for secondary operations.
- Entire row may open details, but explicit controls remain keyboard accessible.
- Loading skeleton, empty state, filtered-empty state, error state, and permission state.

### Detail Pages

Use a stable header with record identifier, primary status, key actions, and contextual metadata. Organise content into summary, operational details, linked records/documents, and activity history.

### Forms

- Use clear sections and short helper text.
- Mark required fields explicitly.
- Validate on blur or submission without clearing user input.
- Disable submission while a request is in flight.
- Warn before leaving a dirty form.
- File uploads show accepted types, maximum size, progress, success, and failure.

## 5. Dashboard

### Agent Dashboard

Recommended content:

- Current level and qualification progress.
- Active/submitted cases.
- Successful cases.
- Personal sales.
- Earned, scheduled, and paid commissions.
- Referral performance permitted by policy.
- Recent case activity.
- Upcoming commission payments where confirmed.

Primary actions:

- Submit New Case.
- View Cases.
- View Commission Statement.

### Staff and Admin Dashboard

Recommended content:

- Total and recent cases.
- Cases requiring review.
- Pending customer payments.
- Total sales for selected period.
- Commission payable, scheduled, and paid.
- Agent/referral performance.
- Recent invoices and receipts.

Avoid a grid of equally prominent cards. Establish one focal metric or operational priority, then group secondary information beneath it.

## 6. Cases

### Case List

Recommended columns:

| Column | Notes |
|---|---|
| Case ID | Stable human-readable reference |
| Customer | Name/company according to permissions |
| Agent | Hidden or simplified for agent-owned view |
| Submitted | Locale-formatted date |
| Sale amount | MYR; show placeholder until known |
| Case status | Text plus consistent badge |
| Payment status | Separate from case status |
| Updated | Last meaningful update |
| Actions | View and permitted secondary actions |

Filters:

- Case status.
- Payment status.
- Agent.
- Submission/update date range.
- Search by permitted identifier or name.

### New/Edit Case Form

Suggested sections pending final field confirmation:

1. Customer information.
2. Electricity/service information.
3. Case details.
4. Supporting documents.
5. Review and submit.

Do not invent mandatory fields. Final fields come from client-approved requirements.

The Version 1 agent submission implementation requires only the customer/company name and latest electricity bill. Contact details and electricity/service fields are optional. Supporting documents are optional and may be uploaded in multiple files. The latest bill and supporting uploads use the shared configured file validation and storage/repository boundary.

### Case Detail

- Case identity, status, assigned agent, and key amounts.
- Customer and service details.
- Status timeline/activity.
- Uploaded supporting documents.
- Quotation and installation information when approved.
- Customer payments and verification state.
- Linked commissions.
- Linked invoices and receipts.
- Role-appropriate actions.

## 7. Agents and Referrals

### Agent List

Recommended columns:

- Agent name and ID.
- Current level.
- Upline.
- Successful cases.
- Annual/personal sales.
- Commission earned.
- Qualification progress.
- Active/inactive status.
- Actions.

Filters:

- Level.
- Status.
- Qualification state.
- Upline/referrer where supported.

### Agent Profile

- Identity and registration details.
- Registration status, RM50 fee status, and manual payment-verification status.
- Current level and approval history.
- Upline.
- Direct recruits.
- Personal and referral sales.
- Successful case count.
- Qualification checklist/progress.
- Commission history.
- Recent activity.

A simple table/list is sufficient for the initial referral view. A full interactive tree is not required for Version 1 unless specifically approved.

### Agent Registration and RM50 Fee

The simplified mock invitation signup page keeps account registration, OTP verification, and payment proof in one registration page. The card transitions from the six initial fields to OTP entry, then to the manual RM50.00 non-refundable name-card-fee invoice and payment form without changing the URL. The payment state shows the application number as the transfer reference, configured bank instructions, the DuitNow QR unavailable state, proof upload, and optional applicant remarks. Applicant payment date and payment reference inputs are omitted. Separate registration/fee statuses remain in force. Pending agents may access onboarding and registration status only until authorised staff approve the registration and verify or waive the fee.

The staff queue must show the application number, applicant name, email/mobile, referrer, profile-completion status, proof of payment, submitted date, registration status, and fee status. Staff can record verified amount, payment date, bank reference, and internal note; verify or reject payment; and approve or reject registration. Verification, rejection, waiver, refund, and activation are confirmation-protected actions with feedback and audit entries. The system must not provide a payment gateway, automatic verification, or a registration-fee receipt.

## 8. Commissions

### Commission List

Recommended columns:

- Commission/reference ID.
- Case.
- Recipient.
- Level.
- Total entitlement.
- First payment.
- Deferred balance.
- Next payment.
- Paid to date.
- Status.
- Actions.

Filters:

- Status.
- Recipient/agent.
- Level.
- Case.
- Due/payment date range.

### Commission Detail

This is a purpose-built financial view, not merely a generic detail card.

Include:

- Source case and verified payment.
- Sale amount and total commission pool.
- Recipient allocation table.
- First-payment distribution table with explicit percentage bases.
- Deferred totals.
- Full 17-month instalment schedule.
- Paid, scheduled, withheld, adjusted, and remaining totals.
- Approval, adjustment, and payment history.
- Permitted financial actions with confirmation and required reason fields.

The UI must label whether a percentage applies to the sale or to the first-payment pool.

## 9. Invoices and Receipts

### Document List

Recommended columns:

- Document number.
- Type: invoice or receipt.
- Customer.
- Case.
- Amount.
- Issue date.
- Payment/status information.
- PDF action.

### Generation Flow

1. Start from the relevant case/payment where possible.
2. Review prefilled values.
3. Complete permitted fields.
4. Preview a clear summary.
5. Generate through the server.
6. Show generated number and download/open action.

Do not manufacture the next document number on the client.

## 10. Reports

Initial report types:

- Case activity.
- Agent performance.
- Sales performance.
- Referral relationships.
- Commission calculations.
- Monthly commission payments.
- Invoices and receipts.

Each report page needs:

- Report description.
- Date range and relevant filters.
- Table preview.
- Result count/totals where meaningful.
- Export action.
- Clear no-data and export-error states.

Charts are optional and should be used only when they clarify a trend or comparison better than a table.

## 11. Responsive Behaviour

- Desktop is the primary administrative workspace.
- Tablet retains tables where they remain readable and collapses secondary filters.
- On mobile, prioritise record identity, status, amount, and primary action.
- Secondary columns may move into expandable row details or a card/list presentation.
- Do not shrink dense tables until text becomes unreadable.
- Financial totals and primary actions remain visible without relying on hover.

## 12. Required UI States

Every feature must consider:

- Initial loading.
- Background refresh where used.
- Empty state for a new account.
- No results after filters.
- Validation failure.
- Server/network failure.
- Expired or unauthenticated session.
- Permission denied.
- Successful mutation.
- Duplicate/conflict response where relevant.

Financial workflows also require:

- Confirmation before approval, adjustment, reversal, or marking paid.
- Required reason where policy demands it.
- Clear outcome showing the resulting status and audit entry.

## 13. Frontend-First Build Order

To reach a reviewable frontend quickly:

1. Establish tokens, typography, app shell, navigation, and shared states.
2. Define shared domain types and realistic mock repositories.
3. Build role-aware dashboard shells.
4. Build case list, submission form, and detail page.
5. Build agent list and profile/referral view.
6. Build commission list and purpose-built detail/schedule view.
7. Build invoices/receipts list and generation flow.
8. Build reports and export states.
9. Test responsive behaviour and accessibility.
10. Replace mock repositories with backend services endpoint by endpoint.

## 14. Frontend Definition of Done

A screen is not done until:

- It uses shared tokens and components.
- Its content and actions match role permissions.
- Loading, empty, error, and success states are present.
- Validation and destructive/financial confirmations are handled.
- It works at agreed desktop and mobile widths.
- Keyboard navigation and visible focus are usable.
- Mock data uses the same shape as the agreed data contract.
- Lint and type-check pass.

## 15. Password Recovery

The public authentication routes are `/forgot-password` and `/reset-password`. Forgot-password requests always show a neutral response so the interface does not reveal whether an email is registered. The reset page validates the provider/service password policy, confirmation matching, reset-link validity/expiry, and one-time use.

The current frontend has no Supabase configuration, so local preview behavior uses the replaceable auth service with an eight-character minimum password policy. Supabase Auth should replace the mock request/session implementation when configured, without changing the routes or page contract.
