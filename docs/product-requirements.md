# Smartegy Product Requirements

## 1. Product Summary

Smartegy needs a responsive web application that manages electricity-saving cases from agent submission through customer payment, commission calculation, and commission tracking. The system centralises case records, supporting documents, agent relationships, invoices, receipts, dashboards, and reports.

The application replaces fragmented spreadsheet and manual follow-up work with a controlled source of truth for agents, operational staff, finance, and management.

## 2. Objectives

- Give agents a secure place to submit and track customer cases.
- Give authorised staff a central view of cases, documents, payments, and generated documents.
- Maintain agent levels and referral/upline relationships.
- Calculate and track commissions only after the relevant customer payment is verified.
- Give each role dashboards and reports appropriate to its responsibilities.
- Preserve an audit history for important financial and administrative changes.

## 3. Release Scope

### Version 1

Version 1 includes:

1. Case tracking and document uploads.
2. Agent and referral management.
3. Commission calculation and tracking.
4. Invoice and receipt generation and retrieval.
5. Agent and administrative dashboards.
6. Operational and management reports.
7. Authentication and role-based access needed for the above functions.
8. Production deployment and basic administrator guidance.

### Version 2

Version 2 is planned separately and includes:

1. EA form generation.
2. WhatsApp integration and automated messaging.
3. Email integration and automated notifications.

Version 2 is not part of the Version 1 implementation or acceptance criteria.

### Excluded Unless Separately Approved

- OCR or automatic data extraction from electricity bills.
- Accounting software integrations.
- Direct bank integration or automated commission disbursement.
- Payment gateway integration.
- Native iOS or Android applications.
- Customer self-service portal.
- Advanced predictive analytics.
- Public or custom third-party APIs.
- Large-scale historical data migration.
- Any function not explicitly described in the approved scope.

## 4. Users and Access

| Role | Primary responsibilities |
|---|---|
| Agent | Complete registration, submit the RM50 registration fee proof, submit cases, upload documents, record the deposit for own cases, confirm proposed installation dates, track own cases, view own/referral information permitted by policy, and view own commissions |
| Staff | Review and manage agent registrations, manually verify registration-fee payments, verify or reject case deposits, propose installation dates, and manage cases, agents, documents, operational statuses, invoices, receipts, commissions, and reports. The Staff view currently matches the Admin view. |
| Admin | Review and manage agent registrations, manually verify registration-fee payments, and manage cases, agents, documents, operational statuses, invoices, receipts, commissions, and reports. The Admin view currently matches the Staff view. |

Detailed differences between Staff and Admin must be confirmed before production. Until then, the mock frontend exposes the same navigation and dashboard content for both roles; the server must independently enforce the eventual permission matrix.

## 5. Core Workflows

### 5.1 Case Submission and Processing

1. An authenticated agent creates a case.
2. The agent enters required customer and case information.
3. The agent uploads an electricity bill and other supporting documents.
4. The system validates required fields and records the submission.
5. Authorised staff review the case and documents.
6. Staff update the case through quotation and payment setup, then verify or reject the deposit submitted by the agent.
7. After a verified deposit, staff propose an installation date; the agent confirms it or requests a different date.
8. The case becomes scheduled only after the agent confirms the proposed date. Related invoices, receipts, payments, and commissions are linked to the case.

Case statuses:

- `draft`
- `under_review`
- `changes_requested`
- `quotation_issued`
- `awaiting_deposit`
- `installation_date_proposed`
- `installation_scheduled`
- `installed_monitoring`
- `trial_review`
- `active_installments`
- `completed`
- `cancelled`

Submission moves a case directly from `draft` to `under_review`; completion happens automatically after all instalments are paid.

### 5.2 Customer Payment Verification

1. The submitting agent records the deposit amount, payment date, and optional reference against the case.
2. The deposit remains pending until authorised staff verify or reject it with a reason.
3. Verification records who verified it and when, and only a verified deposit can unlock date proposal.
4. Staff propose an installation date; the agent confirms it or requests a different date with a reason.
5. Only a verified qualifying payment may trigger commission generation. Reversal or correction requires an authorised action and audit entry.

### 5.3 Agent and Referral Management

The system must maintain:

- Agent identity and contact details.
- Registration and active/inactive status.
- RM50 registration-fee payment proof and manual verification status.
- Current level.
- Direct referrer/upline relationship.
- Successful case count.
- Personal and referral sales performance.
- Qualification progress.
- Commission history.

Proposed qualification rules:

| Level | Qualification |
|---|---|
| Level 1 | At least one successful case |
| Level 2 | At least one recruited agent and six successful cases |
| Level 3 | At least 30 agents and RM3 million in annual sales |

The system displays qualification progress. Promotion remains subject to authorised Smartegy review and approval unless a later rule explicitly automates it.

Each agent must manually transfer RM50.00 as part of registration. The system displays configured payment instructions and the generated agent/application number as the payment reference. The agent submits the payment date, payment reference number, and proof of payment; authorised staff verify or reject the submission. The system does not process the payment, generate a registration-fee receipt, or verify it automatically. Once authorised staff verify the fee, an application with verified email and complete required profile information is automatically approved and activated; incomplete applications remain pending approval until those requirements are satisfied.

### 5.4 Commission Processing

1. A qualifying customer payment is verified.
2. The trusted server identifies eligible recipients in the approved hierarchy.
3. The server calculates total entitlements, initial distributions, and deferred balances.
4. Authorised staff review the generated calculation.
5. Commission entries move through scheduled, approved, paid, withheld, or adjusted states.
6. Staff separately execute any bank payment; Version 1 does not transfer funds automatically.

All mathematical and policy details are defined in `commission-rules.md`.

### 5.5 Invoice and Receipt Processing

Authorised staff can:

- Generate an invoice for a qualifying case.
- Generate a receipt after payment verification.
- Assign sequential document numbers on the server.
- Link the document to its case, customer, agent, and payment where relevant.
- Download the generated PDF.
- View previously issued documents.
- Record issue/payment dates, amounts, and references.

Smartegy must supply approved invoice and receipt templates, company details, numbering rules, tax wording, and required fields.

### 5.6 Reporting

The system provides filterable views and spreadsheet-compatible exports for:

- Case activity.
- Agent performance.
- Sales performance.
- Referral relationships.
- Commission calculations.
- Monthly commission payments.
- Invoices and receipts.

Exports must respect the current user's permissions and applied filters.

## 6. Functional Requirements

### Cases and Documents

- Agents can create, save, submit, and view permitted cases.
- Agents can upload permitted document types subject to size limits.
- Staff can review submissions, update statuses, and add authorised documents.
- Users can search and filter cases by fields permitted for their role.
- Each case shows an activity history for meaningful status and financial changes.

### Agents and Referrals

- Staff can create, update, activate, and deactivate agent records.
- Staff can assign or correct a referrer/upline with an auditable reason.
- The system prevents circular referral relationships.
- Agent profiles show level, upline, direct recruits, performance, and qualification progress.
- Promotion actions record the approving user and time.

### Commissions

- Commissions are generated only from verified qualifying payments.
- The system prevents accidental duplicate generation for the same qualifying event.
- Calculations preserve exact integer-sen totals.
- Authorised users can approve, withhold, mark paid, or adjust an entry.
- Manual adjustments require a reason and retain the original calculated value.
- Users can inspect the full schedule and audit history.
- Approved commission data can be exported for separate bank processing.

### Invoices and Receipts

- Document numbers are generated atomically on the server.
- Generated PDFs are stored securely and linked to the relevant record.
- Previously issued documents remain retrievable by authorised users.
- A cancellation or correction does not silently overwrite the audit history.

### Dashboards

The agent dashboard shows, subject to permissions:

- Submitted and successful cases.
- Current case statuses.
- Personal sales.
- Referral performance.
- Earned, scheduled, and paid commissions.
- Level qualification progress.

The administrative dashboard shows, subject to permissions:

- Total and recent cases.
- Cases by status.
- Pending document reviews.
- Pending customer payments.
- Total sales.
- Commission payable, scheduled, and paid.
- Agent/referral performance.
- Recently issued invoices and receipts.

## 7. Non-Functional Requirements

- Responsive on supported desktop, tablet, and mobile widths.
- Keyboard-accessible core workflows with visible focus states.
- Secure authentication and server-side role/ownership checks.
- Private document storage with time-limited access where appropriate.
- Auditability for financial, permission, hierarchy, and status changes.
- Clear loading, empty, validation, error, and permission-denied states.
- Locale-aware display for MYR, dates, and times.
- Reasonable performance for the expected early-stage user base; list pages use pagination rather than loading unbounded records.

## 8. Version 1 Acceptance Criteria

Version 1 is functionally complete when:

- Agents can authenticate, submit cases, upload documents, and view permitted status information.
- Staff can review and update case information and statuses.
- Agent levels and valid referral relationships can be maintained.
- Verified qualifying payments can produce commission records using the approved rules.
- Users can inspect first-payment and deferred commission information appropriate to their role.
- Invoices and receipts can be generated, linked, retrieved, and downloaded.
- Agent and admin/management dashboards display the agreed information.
- Required reports can be filtered and exported.
- Permission checks protect role- and ownership-restricted data.
- Critical issues found during acceptance testing are resolved before production handover.

## 9. Open Decisions

The following must be confirmed before the affected backend behaviour is considered final:

1. Final case status list and allowed transitions.
2. Exact required fields for customers, cases, agents, invoices, and receipts.
3. File types, file-size limits, and document retention policy.
4. Exact role/permission matrix, including who verifies payments and approves commissions.
5. Whether referral depth shown to agents is limited.
6. Exact definition of a successful case and annual sales period.
7. Invoice/receipt numbering, templates, taxes, and cancellation rules.
8. Final report columns and export format.

## 10. Confirmed Version 1 Agent Registration and Onboarding

1. An applicant opens an invitation/referral link containing a valid referral code.
2. The applicant creates an account with full name, email address, mobile number, password, password confirmation, and acceptance of the Terms of Use and Privacy Notice.
3. The applicant verifies their email address.
4. The applicant completes only the confirmed profile information: full name, email address, and mobile number. Identification, tax, emergency-contact, and banking fields are not part of this flow.
5. The applicant views Smartegy's configured instructions for manually transferring RM50.00.
6. The applicant enters the payment date and payment reference number and uploads proof of payment.
7. Authorised staff review the application and payment proof, record the verified amount/payment date/bank reference/internal note, and verify or reject the payment.
8. Authorised staff verify or reject the payment proof. Verification automatically approves and activates the registration when email and required profile information are complete; incomplete applications remain pending approval. Authorised staff may reject the registration.

The system generates the agent/application number. A valid referral link pre-fills the referral code, displays the referring agent, and locks the confirmed upline. Applicants cannot search for or select another upline.

The registration page displays a website-issued invoice for the non-refundable RM50.00 name-card fee after the account details and email OTP are successfully verified. The applicant submits proof of payment on the same page. This invoice is not a payment receipt; payment remains subject to manual staff verification.

Registration status and registration-fee status are separate. Registration status is `draft`, `pending_approval`, `active`, `rejected`, or `suspended`. Registration-fee status is `unpaid`, `pending_verification`, `verified`, `rejected`, `waived`, or `refunded`.

An agent can become active only when email is verified, required profile information is complete, the RM50 fee is verified or formally waived, and authorised staff approve the registration. Pending agents may log in but can access only onboarding and registration-status screens. Agents cannot assign or modify role, level, commission percentage, registration status, fee-verification status, or confirmed upline. Privileged registration actions create an audit entry with action, previous/new status, acting user, timestamp, and reason/note where applicable.

Payment instructions and temporary bank values belong to configuration/mock data, not presentational components. The DuitNow QR is an explicit unavailable state until supplied. Version 1 does not provide a payment gateway, automatic verification, or a registration-fee receipt.

### 10.1 Simplified Mock Applicant Flow

For the frontend mock flow, applicant onboarding is reduced to two pages. The first page collects the six initial fields (full name, email, mobile number, password, password confirmation, and the locked invitation/referral code), plus Terms of Use and Privacy Notice acceptance. The applicant requests and verifies a mock email OTP; the mock code is `123456` and is not a production authentication mechanism. After email verification, the application is created and the applicant goes directly to the RM50 payment page.

The second page displays the configured RM50 payment instructions and application number as the transfer reference. Applicant submission contains only proof-of-payment upload and optional remarks. Applicant payment date and payment reference inputs are intentionally omitted from this mock flow; authorised staff still record the verified payment date and bank reference during review.
