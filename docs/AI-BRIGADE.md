# Kiteline AI Brigade

## Purpose

AI Brigade is Kiteline's multi-agent kitchen operations layer. A Manager Agent receives one operational request, selects the relevant specialist agents, runs them against the current Kiteline workspace, and presents one prioritised result.

This is part of **Kiteline**, not Libraix.

## V1 operating model

- Read-only analysis: agents do not automatically change kitchen records.
- Offline-capable: V1 can analyse `Store.db` without an external AI model or API key.
- Maximum 4 specialists per request to control latency, noise and future model cost.
- Manager/leadership sidebar launcher.
- Existing Kiteline tenant/site data remains the source of truth.
- Safety and allergen findings are advisory review signals; responsible kitchen management retains sign-off.

## Agent registry

1. Food Safety Agent — temperatures, live alerts and immediate corrective actions.
2. HACCP Agent — CCPs, opening/closing checks and compliance records.
3. Allergen & Dietary Agent — recipe allergen completeness and dietary controls.
4. Stock Agent — stock levels, batch dates, FIFO/FEFO and expiry risk.
5. Purchasing Agent — reorder candidates and supplier coverage.
6. Menu Agent — service menu readiness and recipe linkage.
7. Recipe Agent — standard recipe completeness, methods, yields and costs.
8. Costing Agent — food cost completeness and waste value.
9. Cleaning Agent — hygiene and cleaning checklist completion.
10. Maintenance Agent — equipment faults, service and calibration due dates.
11. Waste Agent — waste entries, value and reduction priorities.
12. Supplier Agent — approved suppliers and due-diligence dates.
13. Training Agent — training and certificate expiry risk.
14. Kitchen Operations Agent — cross-functional shift-readiness overview.
15. Compliance Audit Agent — audit-readiness cross-check across the workspace.

The Manager Agent is the orchestrator and is not counted as a specialist.

## Request flow

1. User enters a kitchen operations request.
2. The Manager Agent scores the request against specialist domains.
3. Up to four relevant specialists are selected.
4. Specialists independently inspect the current site's Kiteline data.
5. Results are classified as good, info, warning or critical.
6. The Manager Agent deduplicates recommended actions and produces an executive summary.
7. No records are modified automatically in V1.

## Example

Request:

> Check whether we are ready for dinner service and tell me the top safety, stock and production priorities.

Likely specialists:

- Kitchen Operations
- Food Safety
- Stock
- Menu or Recipe

The user receives one combined response rather than four separate conversations.

## Safety boundaries

High-risk agents include Food Safety, HACCP, Allergen & Dietary, Cleaning, Maintenance and Compliance Audit.

V1 must never:

- declare food allergy-safe solely from AI output;
- delete, alter or fabricate compliance records;
- automatically close a critical alert;
- automatically approve a supplier;
- automatically mark HACCP or cleaning checks complete;
- create purchasing commitments without user approval;
- conceal uncertainty or missing data.

## Next technical phase

The local orchestration layer is deliberately separated from model calls. The next phase can connect the same registry to the existing Kiteline AI connector and model provider while preserving tenant/site permissions and audit logs.

Recommended next additions:

- server-side `/api/agents/plan` and `/api/agents/run` endpoints;
- model-powered specialist reasoning using existing Kiteline AI credentials;
- persistent agent run/audit history;
- human approval queue for proposed actions;
- controlled write tools for low-risk actions;
- scheduled shift-opening, pre-service and close-down agent runs;
- purchasing draft generation with explicit approval before sending;
- live notification escalation for critical food-safety conditions;
- agent performance/cost/latency metrics.
