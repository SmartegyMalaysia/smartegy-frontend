# Smartegy Development Instructions

## Required Context

Before implementing or changing a feature, read the relevant project documents:

- `docs/product-requirements.md` — authoritative product scope and workflows.
- `docs/commission-rules.md` — authoritative commission rules and worked example.
- `docs/frontend-spec.md` — routes, screens, tables, interactions, and responsive behaviour.
- `docs/data-contracts.md` — shared frontend/backend types and integration boundaries.
- `.interface-design/system.md` — current visual system and reusable UI patterns.

If documents conflict, use this priority order:

1. The user's latest explicit instruction.
2. `docs/product-requirements.md` for product scope.
3. `docs/commission-rules.md` for commission behaviour.
4. `docs/data-contracts.md` for integration shapes.
5. `docs/frontend-spec.md` for presentation and interaction details.
6. `.interface-design/system.md` for visual decisions.

Do not silently resolve a conflict involving money, permissions, commission eligibility, or payment status. Flag it before implementation.

## Project Scope

- Version 1 includes case tracking and document uploads, agent and referral management, commission calculation and tracking, invoices and receipts, dashboards, and reports.
- Version 2 includes EA form generation, WhatsApp integration, and email integration.
- Do not implement Version 2 features unless the user explicitly requests Version 2 work.
- Do not add excluded integrations or business rules merely because they seem useful.
- Treat unresolved or provisional rules as configuration or mock behaviour; do not hard-code assumptions as confirmed policy.

## Technical Direction

- Use Next.js with TypeScript.
- Use Tailwind CSS for styling.
- Use Supabase PostgreSQL, Auth, and Storage for the production backend.
- Prefer server-side authorization and validation for protected operations.
- Never trust a role, commission value, payment verification, or ownership check supplied only by the client.
- Keep shared domain types in one location and avoid duplicating enums across features.
- During frontend-first development, access data through a replaceable service/repository layer so mock data can later be exchanged for Supabase without rewriting components.
- Use Malaysian Ringgit (`MYR`) and locale-aware date formatting. Store monetary values as integer sen, not floating-point ringgit.
- Store timestamps in UTC and render them in the relevant user timezone.

## Interface Rules

- Use the installed `interface-design` skill for product UI work and design review.
- Use the installed `react-best-practices` skill for React/Next.js implementation and performance review.
- Keep their responsibilities separate: `interface-design` decides visual/interaction quality; `react-best-practices` guides code structure, rendering, data fetching, and performance.
- If a skill recommendation conflicts with an approved Smartegy requirement, preserve the requirement and document the technical trade-off.
- Load `.interface-design/system.md` before changing interface patterns.
- Follow a table-first SaaS dashboard direction, adapted to Smartegy rather than copied from the visual reference.
- Keep the admin portal information-dense and the agent portal simpler and task-focused.
- Every data view must include loading, empty, error, and permission-denied states where applicable.
- Tables must remain usable on small screens through prioritised columns, controlled horizontal scrolling, or card/list alternatives.
- Use status badges consistently; never use colour as the only status indicator.
- Destructive or financial actions require clear confirmation and feedback.
- Commission details need a dedicated detail view or drawer; do not compress the 17-month schedule into a generic summary row.

## Roles and Security

- Preserve role-based separation among `agent`, `staff`, and `admin`. Staff and admin currently share the same view and permissions in the frontend preview; their differences will be defined later.
- Agents may access only their own permitted cases, documents, referral information, and commissions.
- Staff and admin may manage operational records according to the currently shared preview permissions.
- Privileged updates require server-side authorization and an audit trail.

## Quality Bar

- Build accessible semantic UI with labelled controls, keyboard navigation, visible focus states, and sufficient contrast.
- Reuse established components and tokens instead of introducing one-off styles.
- Keep business calculations out of presentational components.
- Do not calculate final commission entitlements in the browser; display results returned by the trusted server calculation.
- Add or update tests for important business logic and permission-sensitive flows.
- Run lint, type-check, and relevant tests after meaningful changes.
- Do not claim a task is complete while required states, validation, or responsive behaviour are missing.

## Change Discipline

- Preserve unrelated work in the repository.
- Explain changes to shared database types, permissions, commission logic, or route contracts before applying broad modifications.
- Update the relevant Markdown document when an approved product, contract, or design decision changes.
- Record genuinely reusable visual patterns in `.interface-design/system.md`; do not fill it with page-specific trivia.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
