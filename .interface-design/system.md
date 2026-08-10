# Smartegy Design System

> Initial design direction for frontend development. Use `interface-design` to review and evolve this file as real screens are built. Record only reusable decisions here.

## Direction

- **Personality:** Sophistication & Trust with practical data density.
- **Product type:** B2B operations and financial administration dashboard.
- **Foundation:** Cool neutral surfaces with a restrained blue/teal brand accent.
- **Depth:** Borders-first; limited soft elevation for overlays and intentionally raised surfaces.
- **Density:** Compact enough for operational tables, with comfortable forms and detail pages.
- **Reference:** https://dribbble.com/shots/25812342-SAAS-Category-Table-Dashboard-Page-UI-UX
- **Interpretation:** Use the reference's clean sidebar, filtering, summary, and table hierarchy. Do not copy its branding or force Smartegy workflows into its exact layout.

## Principles

1. Operational clarity comes before decoration.
2. Financial states must be explicit in text, not colour alone.
3. One primary action per page region.
4. Admin screens may be dense; agent screens should be simpler and more guided.
5. Repeated patterns must use shared tokens and components.
6. Empty, loading, error, and permission states are part of the design.

## Tokens

These are starting values, not a substitute for checking the implemented theme and brand assets.

### Spacing

- Base unit: `4px`.
- Scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Standard page gutter: `24px` desktop, `16px` mobile.
- Standard section gap: `24px`.
- Compact table cell padding: `10px 12px`.
- Form field vertical gap: `16px`.

### Radius

- Small controls and badges: `6px`.
- Inputs and buttons: `8px`.
- Cards and panels: `10px`.
- Dialogs and drawers: `12px`.
- Avoid excessive pill shapes; reserve full pills for statuses, compact filters, or toggles.

### Colour Roles

- App background: cool off-white/slate tint.
- Primary surface: white or the lightest theme surface.
- Secondary surface: subtle cool neutral.
- Border: low-contrast cool neutral with sufficient separation.
- Foreground: near-black cool slate.
- Muted text: mid-dark slate that still meets contrast requirements.
- Brand/action: restrained blue or teal, final value to follow supplied Smartegy branding.
- Focus: clearly visible blue/teal ring with adequate contrast.
- Success: green plus text/icon.
- Warning: amber plus text/icon.
- Danger: red plus text/icon.
- Informational: blue plus text/icon.

Do not choose final brand hex values until the logo/brand palette is available in the repository.

### Typography

- Use one legible sans-serif family unless supplied branding requires otherwise.
- Page title: `28–32px`, semibold, tight line height.
- Section title: `18–20px`, semibold.
- Body: `14–16px`, regular.
- Table and metadata: `13–14px` with adequate line height.
- Financial values: tabular numerals.
- Avoid all-uppercase headings except very short metadata labels.

### Motion

- Use short `150–200ms` transitions for hover, focus, menus, drawers, and state feedback.
- Respect reduced-motion preferences.
- Do not animate financial totals merely for spectacle.

## Layout Patterns

### App Shell

- Persistent/collapsible sidebar on desktop.
- Drawer navigation on mobile.
- Page header aligns title, supporting context, and one primary action.
- Main content uses consistent gutters and avoids unnecessary maximum-width constraints on data-heavy pages.

### Page Header

- Left: page title and optional one-line description.
- Right: primary action, with secondary actions in a menu where appropriate.
- Filters belong below the title rather than crowding the primary action row.

### Dashboard Composition

- Establish one focal operational or financial priority.
- Use a limited number of summary cards; do not give every metric identical visual weight.
- Follow summaries with actionable queues, trends, or recent records.

### Data Table

- Sticky header where long tables justify it.
- Clear alignment: text left, statuses left/centre, numbers right.
- Tabular numerals for money.
- Row hover is subtle and not the only interaction cue.
- Primary record identity remains visible at narrow widths.
- Secondary columns collapse into row detail or mobile cards instead of becoming unreadably narrow.

### Filters

- Search and most-used filters remain visible.
- Less common filters may live in a popover/drawer.
- Active filters are visible and individually removable.
- Include a clear reset action when filters are active.

### Status Badge

- Combine colour with plain-language text.
- Use consistent semantic colours across cases, payments, commissions, and documents.
- Do not reuse the same colour for contradictory meanings on the same screen.

### Form

- Group related fields under short section headings.
- Labels remain visible; placeholders are examples, not replacements for labels.
- Helper and error text reserve enough space to avoid disruptive layout shifts where practical.
- Primary submit action is visually dominant and reports progress.

### Detail Drawer

- Use for quick inspection or lightweight edits.
- Use a full page for complex case histories and commission schedules.
- A drawer must not hide information required to make a financial approval decision.

### Confirmation Dialog

- Name the action and affected record.
- Explain irreversible or financial consequences.
- Require a reason where the underlying policy requires it.
- Make cancel safe and visually available.

## Page-Specific Patterns

### Commission Detail

- Treat as a dedicated financial workspace.
- Clearly separate sale-based entitlement percentages from first-payment-pool shares.
- Show reconciliation totals and the 17-month schedule.
- Keep approval/adjustment history visible near financial actions.
- Use full text labels for calculated, scheduled, approved, paid, withheld, adjusted, and reversed.

### Agent Qualification

- Use a checklist or compact progress block for each requirement.
- Show current versus required values.
- Keep formal promotion approval separate from visual progress completion.

### Case Timeline

- Use a vertical chronological pattern on details/mobile.
- Show actor, action, and timestamp.
- Highlight current status without hiding previous events.

## Accessibility

- Target WCAG AA contrast.
- Use semantic landmarks, headings, tables, labels, and buttons.
- Visible focus is mandatory.
- Every icon-only control has an accessible name.
- Dialogs and drawers trap and restore focus correctly.
- Errors are associated with their fields and summarised when a long form fails.
- Do not require hover to reveal essential information or actions.

## Open Design Decisions

- Final brand colour values from the supplied logo/brand assets.
- Final typeface based on licensing and Next.js loading strategy.
- Light-only versus light/dark theme for Version 1.
- Exact desktop sidebar width and collapse behaviour.
- Whether commission quick view uses a drawer before navigating to the full detail page.
- Final mobile table/card threshold after testing real data.

## Foundation Decisions (Version 1)

- Use white and cool grey surfaces as the structural base, with deep navy (`#293b80`) for primary text/actions and fresh green (`#49ad50`) for brand identity, focus, and positive highlights drawn from the supplied logo.
- Use a borders-first light canvas with `10px` panels, `8px` controls, and a `4px` base spacing rhythm. Raised shadows are reserved for dialogs and the mobile drawer.
- Dashboard composition uses one dark focal priority panel, a compact four-card metric row, then a recent-record table and a secondary queue/team panel. This weighting applies to future role dashboards: agent views emphasize personal progress; staff and admin views currently share the same operational queue layout.
- The desktop sidebar collapses to an icon rail and becomes a focusable off-canvas drawer below the mobile breakpoint. Navigation labels remain permission-filtered; the development role switcher is a preview-only control.
- Dense tables preserve readable minimum widths and use horizontal scrolling on small screens. Primary identity, status, amount, and action remain the priority columns.
- Status badges always include visible text plus a semantic dot; colour is never the sole status cue. Financial values use tabular numerals and `en-MY` MYR formatting from integer sen.
- The authenticated entry screen uses a split “operations control room” composition: a white brand/context panel on the left, a cool-grey form canvas on the right, and a single navy sign-in action with green identity accents as the focal point. On narrow screens, the context stacks above the form.
- Login forms use 46px inputs/actions, 8px control radius, explicit labels, inline service feedback, and a small development-preview escape hatch. Authentication remains behind a repository boundary and `/api/auth/login` placeholder until Supabase Auth is connected.
