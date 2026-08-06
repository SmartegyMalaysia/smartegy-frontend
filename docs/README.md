# Smartegy Project Documentation

This directory converts the approved proposal into working product and engineering references.

| File | Purpose | Primary readers |
|---|---|---|
| `product-requirements.md` | Version scope, roles, workflows, functional requirements, and acceptance criteria | Everyone |
| `commission-rules.md` | Commission entitlements, first payment, deferred schedule, approvals, and worked example | Frontend and backend |
| `frontend-spec.md` | Routes, layouts, tables, forms, states, and responsive behaviour | Frontend |
| `data-contracts.md` | Proposed shared types, data shapes, enums, and integration boundaries | Frontend and backend |
| `original-proposal.md` | Commercial and contractual source document captured for reference | Project owner |

Repository-level implementation rules are in `../AGENTS.md`. Visual decisions used by the `interface-design` skill are in `../.interface-design/system.md`.

The project may use both `interface-design` and `react-best-practices`. They are complementary: the former governs product design and visual consistency, while the latter governs React/Next.js implementation quality and performance.

## Authority

The latest client-approved requirements override the original proposal when they are recorded in the focused documents. Commercial terms remain in `original-proposal.md` and should not leak into application UI or source code.

## Working Method

1. Confirm the relevant workflow in `product-requirements.md`.
2. Check `commission-rules.md` before touching commission-related UI or logic.
3. Agree the relevant shape in `data-contracts.md` before connecting frontend and backend.
4. Build the screen using `frontend-spec.md` and `.interface-design/system.md`.
5. Update the documents when a decision is approved.
