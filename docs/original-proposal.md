# Proposal for Smartegy Electricity Commission Management System

**Prepared for:** Smartegy Sdn Bhd  
**Prepared by:** Damian Teh  
**Proposal date:** 5 August 2026  
**Target Version 1 launch:** 5 September 2026

> This Markdown copy is retained as the commercial and scope reference. The formatted Google Doc remains the presentation version. Focused engineering decisions are maintained in the other files under `docs/`.

## 1. Project Overview

Smartegy requires a web-based system to manage electricity-saving cases from agent submission through payment and commission tracking.

The proposed system will centralise case records, customer documents, agent relationships, commission calculations, invoices, receipts, dashboards, and management reports. This will reduce reliance on spreadsheets and manual follow-ups while giving agents and staff a clearer view of each case.

## 2. Project Objectives

Version 1 aims to:

- Provide a central platform for agents and staff to manage cases.
- Maintain agent profiles, referral relationships, levels, and sales records.
- Calculate and track commissions based on Smartegy's commission structure.
- Generate invoices and receipts linked to cases, plus registration invoices linked to agents.
- Provide dashboards and reports for operational and management use.
- Launch a functional production system by 5 September 2026.

## 3. Version 1 Scope

### 3.1 Case Tracking and Document Uploads

Agents can securely log in, submit new customer cases, enter required information, upload electricity bills and supporting documents, view their cases and statuses, and access documents made available to them.

Authorised staff can review cases and documents, update case information and status, upload quotations, record installation and payment information, link invoices/receipts/commissions, and search or filter case records.

Proposed statuses are Submitted, Under review, Quotation prepared, Pending customer acceptance, Pending installation, Pending payment, Active, Completed, and Cancelled. The final list will be confirmed during configuration.

### 3.2 Agent and Referral Management

The system maintains agent profiles, registration information, the RM50 name-card-fee invoice, payment proof and manual verification status, level, referrer/upline, successful cases, personal and referral sales, qualification progress, and active/inactive status.

| Level | Qualification |
|---|---|
| Level 1 | At least one successful case |
| Level 2 | At least one recruited agent and six successful cases |
| Level 3 | At least 30 agents and RM3 million in annual sales |

Promotion remains subject to authorised Smartegy review and approval. As part of registration, the system issues an RM50 name-card-fee invoice and makes it available to the agent on the website. The fee is non-refundable, payment is made manually, and authorised staff verify the submitted proof of payment. Agent activation requires staff approval and verification of the fee.

### 3.3 Commission Calculation and Tracking

Commission is generated only after the relevant customer payment is verified by authorised staff.

Approved example:

- Total sale: RM24,500
- Total commission: 20% of the sale
- Total commission pool: RM4,900
- Verified monthly savings after installation: 2,253 kWh × RM0.5170 = RM1,164.80
- First three monthly instalments: RM1,164.80 × 3 = RM3,494.40
- First-payment commission pool: RM1,747.20
- Deferred commission balance: RM3,152.80
- Deferred period: 17 months

| Recipient | Percentage of sale | Total entitlement |
|---|---:|---:|
| Level 1 | 5.5% | RM1,347.50 |
| Level 2 | 3.0% | RM735.00 |
| Level 3 | 1.5% | RM367.50 |
| Office | 10.0% | RM2,450.00 |
| **Total** | **20.0%** | **RM4,900.00** |

The first-payment pool is allocated as follows. These percentages are shares of the first-payment pool, not percentages of the total sale.

| Recipient | Share of first-payment pool | First payment | Deferred balance |
|---|---:|---:|---:|
| Level 1 | 60% | RM1,048.32 | RM299.18 |
| Level 2 | 15% | RM262.08 | RM472.92 |
| Level 3 | 5% | RM87.36 | RM280.14 |
| Office | 20% | RM349.44 | RM2,100.56 |
| **Total** | **100%** | **RM1,747.20** | **RM3,152.80** |

Each deferred balance is distributed across 17 months. The final instalment absorbs any rounding difference.

The first-payment pool is calculated as `(verified monthly electricity savings after installation × 3 months) ÷ 2`. In this example, `(RM1,164.80 × 3) ÷ 2 = RM1,747.20`.

Version 1 supports automatic calculation from approved inputs, eligible-recipient identification, first/deferred schedules, payment tracking, statuses, authorised adjustments with reasons, statements, spreadsheet export, and audit history.

Direct bank integration is excluded.

### 3.4 Invoices and Receipts

Authorised staff can generate invoices and receipts, including the RM50 non-refundable name-card-fee invoice linked to an agent registration, assign sequential numbers, link documents to the relevant case/customer/agent, download PDFs, retrieve issued documents, and record payment details. The name-card-fee invoice is made available to the agent on the website; payment remains manual and is verified by authorised staff. Smartegy will provide approved templates and required fields.

### 3.5 Dashboards and Reports

The agent dashboard includes submitted and successful cases, statuses, personal sales, referral performance, commissions, and level progress.

The administrative dashboard includes case totals/statuses, pending reviews/payments, sales, commission totals, agent/referral performance, and recent invoices/receipts.

Filterable reports cover cases, agents, sales, referrals, commissions, monthly commission payments, invoices, and receipts, with spreadsheet-compatible export.

## 4. User Roles

| Role | Main access |
|---|---|
| Agent | Submit cases, upload documents, track cases, and view personal commissions |
| Admin/Staff | Manage cases, agents, documents, payments, invoices, and receipts |
| Finance/Management | Review commissions, payment records, dashboards, and reports |

Detailed permissions will be finalised during configuration.

## 5. Proposed Technology

- Frontend and server: Next.js
- Application hosting: Vercel
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Document storage: Supabase Storage
- Deployment: Git-based deployment through the client's Vercel account

Vercel, Supabase, and domain accounts should be registered under Smartegy's ownership where possible.

## 6. Development Schedule

| Phase | Target period | Main activities |
|---|---|---|
| Planning and setup | 5–9 August | Requirements, database structure, screens, and setup |
| Core development | 10–23 August | Case, agent, referral, commission, and document modules |
| Integration | 24–31 August | Module integration, dashboards, reports, and document generation |
| User acceptance testing | 1–4 September | Client testing, corrections, and production preparation |
| Version 1 launch | 5 September | Production deployment and handover |

The timeline depends on timely client rules, templates, branding, sample data, approvals, and feedback.

## 7. Deliverables

### Version 1

- Responsive web application.
- Authentication for agents and staff.
- Case and document management.
- Agent registration, RM50 name-card-fee invoicing and manual verification, and referral management.
- Commission calculation and tracking.
- Invoice and receipt generation.
- Dashboards and reports.
- Production deployment.
- Basic administrator guidance.
- Three months of post-launch support.

### Version 2

- EA form generation.
- WhatsApp integration and automated messaging.
- Email integration and automated notifications.

Version 2 will be scoped, scheduled, and quoted separately.

## 8. Items Excluded From Both Versions Unless Added by Variation

- OCR or automatic extraction from electricity bills.
- Accounting software integration.
- Direct banking or automatic commission disbursement.
- Payment gateway integration.
- Native mobile applications.
- Customer self-service portal.
- Advanced predictive analytics.
- Third-party API development.
- Large-scale historical data migration.
- Features not described in the proposal.

## 9. Commercial Proposal

### Development Fee

Estimated Version 1 development fee: **RM15,000–RM17,000**.

The final fixed amount will be confirmed when detailed screens, commission inputs, and document templates are approved.

### Hosting

The development fee includes standard Vercel and Supabase hosting for the first three months after launch. Smartegy becomes responsible for ongoing charges after that period. Usage beyond standard allowances and approved upgrades are charged separately. Domain registration and renewal are excluded unless expressly included.

### Post-Launch Support

**RM500 per month for three months — RM1,500 total.**

Support includes defects in agreed Version 1 functions, deployment-related assistance, minor configuration/report adjustments, and reasonable technical guidance. New modules, major workflow changes, and integrations are quoted separately.

| Item | Amount |
|---|---:|
| Version 1 development | RM15,000–RM17,000 |
| Three months of support | RM1,500 |
| **Estimated total** | **RM16,500–RM18,500** |

## 10. Proposed Payment Schedule

| Milestone | Payment |
|---|---:|
| Project confirmation and commencement | 30% |
| Completion of staging system for user testing | 40% |
| Production launch and handover | 30% |

Support is invoiced monthly during the three-month support period.

## 11. Changes to Scope

Functions not expressly included are additional scope. Material changes to requirements, commission logic, timeline, or architecture must be assessed and approved for price and schedule impact before implementation.

## 12. Acceptance Criteria

Version 1 is delivered when agents can submit cases/documents; staff can review/update cases; agent registrations, RM50 non-refundable name-card-fee invoices, manual fee verification and referral relationships can be maintained; commissions can be calculated and tracked using approved rules; invoices/receipts can be generated; agreed dashboards/reports work; production deployment is complete; and critical acceptance-test issues are resolved.

## 13. Approval

**For Smartegy Sdn Bhd**

Name: ______________________________  
Position: ___________________________  
Signature: __________________________  
Date: ______________________________

**Service Provider**

Name: Damian Teh  
Signature: __________________________  
Date: ______________________________
