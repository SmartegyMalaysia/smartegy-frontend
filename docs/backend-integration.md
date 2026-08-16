# Frontend/backend integration status

The frontend uses repository boundaries. Each repository selects a Supabase implementation when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured; otherwise it keeps the existing mock implementation for local UI preview. The login form posts to the Next.js `/api/auth/login` route, which exchanges the credentials with Supabase Auth and writes the SSR session cookies.

## Wired repositories

| Frontend capability | Supabase source | Writes |
| --- | --- | --- |
| Authentication | `/api/auth/login` → Supabase Auth | password sign-in, reset email, password update, sign-out |
| Registration | `agent_registrations`, registration RPCs, private Storage | OTP, application, profile completion, fee proof, staff review |
| Cases | `case_overview`, case tables, case RPCs, private Storage | create case, register/upload/finalize documents, submit transition |
| Dashboard | `case_overview`, `agent_commission_statement`, `agents` | read-only |
| Agents | `agents`, `agent_level_history`, `promotion_requests`, qualification RPCs | promotion request/review |
| Commissions | `agent_commission_statement` | read-only |
| Payouts | `commission_entries`, `agents`, `agent_payment_details` | mark approved entries paid through `set_commission_status` |
| Profile | `profiles`, `agents`, `agent_registrations`, Supabase Auth | display name/phone/email confirmation |

## Mapping rules

- Backend monetary `numeric` values are converted from RM to integer sen for UI types.
- Backend case statuses are mapped to the smaller UI status vocabulary where necessary; the database remains authoritative.
- Agent level enums (`level_1`/`level_2`/`level_3`) map to UI levels `1`/`2`/`3`.
- The browser never sends a trusted role, commission amount, fee amount, recipient, or upline. Sensitive writes use RPCs and RLS.
- `Open development preview` enables a tab-scoped mock view for local development; keep this entry point out of production deployments if the preview data should not be exposed.

## Known contract gaps

- The backend does not expose a demotion workflow; the frontend reports demotion as unsupported.
- Commission statement rows are entry-level; the UI aggregates them into the existing commission summary shape.
- Payout data is available for approved/paid agent entries. Creating payout batches and bank export remains a staff workflow that should be added to the payout screen when required.
- Registration bank details currently come from `portal_settings` in the backend; the registration screen still needs a production settings read instead of its preview constants.
