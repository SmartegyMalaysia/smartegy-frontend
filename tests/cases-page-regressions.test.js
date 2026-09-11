const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const queueSource = fs.readFileSync(path.resolve(__dirname, "../components/case-queue.tsx"), "utf8");
const workspaceSource = fs.readFileSync(path.resolve(__dirname, "../components/case-workspace.tsx"), "utf8");
const workflowSource = fs.readFileSync(path.resolve(__dirname, "../lib/case-workflow.ts"), "utf8");
const filterSource = fs.readFileSync(path.resolve(__dirname, "../components/filter-select.tsx"), "utf8");
const tableSource = fs.readFileSync(path.resolve(__dirname, "../components/data-table.tsx"), "utf8");
const typesSource = fs.readFileSync(path.resolve(__dirname, "../lib/types.ts"), "utf8");
const iconsSource = fs.readFileSync(path.resolve(__dirname, "../components/icons.tsx"), "utf8");
const { mockCasesRepository, derivePaymentStatus } = require(path.resolve(__dirname, "../lib/case-repository.ts"));

const staff = {
  id: "user-002",
  role: "staff",
  displayName: "Farid Iskandar",
  email: "farid@smartegy.example",
  agentId: null,
};

function quotedValues(body) {
  return [...body.matchAll(/"([^"\\]+)"|'([^'\\]+)'/g)].map((match) => match[1] ?? match[2]);
}

function arrayValues(source, declaration) {
  const match = source.match(new RegExp(`const ${declaration}[^=]*= \\[([^\\]]*)\\]`));
  assert.ok(match, `Could not find ${declaration} in the cases queue.`);
  return quotedValues(match[1]);
}

function unionValues(source, declaration) {
  const match = source.match(new RegExp(`export type ${declaration} = ([^;]+);`));
  assert.ok(match, `Could not find ${declaration} in the shared types.`);
  return quotedValues(match[1]);
}

test("cases search explicitly documents and supports case number, customer, and agent", async () => {
  assert.ok(queueSource.includes('placeholder="Case number, customer, or agent"'), "The cases search placeholder must name case number, customer, and agent.");

  const result = await mockCasesRepository.listPage(staff, { page: 1, pageSize: 100 });
  assert.equal(result.ok, true);
  const sample = result.data.items[0];
  assert.ok(sample, "Expected seeded case data for search regression coverage.");

  for (const [field, term] of [
    ["case number", sample.caseNumber],
    ["customer", sample.customerDisplayName],
    ["agent", sample.agentName],
  ]) {
    const filtered = await mockCasesRepository.listPage(staff, { search: term, page: 1, pageSize: 100 });
    assert.equal(filtered.ok, true, `${field} search should succeed.`);
    assert.ok(filtered.data.items.some((item) => item.id === sample.id), `${field} search should return the matching case.`);
  }
});

test("stage filter options use every recorded case status instead of grouped stage buckets", () => {
  const actualCaseStatuses = unionValues(typesSource, "CaseStatus");
  const stageOptions = arrayValues(queueSource, "caseStatuses");
  assert.deepEqual(stageOptions, ["all", ...actualCaseStatuses]);
});

test("payment filter is named Payment Status and matches the case-directory payment statuses", () => {
  const actualPaymentStatuses = unionValues(typesSource, "PaymentStatus");
  const paymentOptions = arrayValues(queueSource, "paymentStatuses");
  assert.deepEqual(paymentOptions, ["all", ...actualPaymentStatuses]);
  assert.ok(queueSource.includes("<label><span>Payment Status</span>"), "The cases payment filter must be labeled Payment Status.");
  assert.ok(queueSource.includes('allLabel="All payment statuses"'), "The cases payment filter must use payment-status wording.");
});

test("dropdown labels use consistent title case without changing filter values", () => {
  assert.ok(filterSource.includes('replaceAll("_", " ")'), "Dropdown labels should keep snake_case values readable.");
  assert.ok(filterSource.includes("replace(/\\b[a-z]/g"), "Dropdown labels should capitalise each word.");
  assert.ok(queueSource.includes('pending_verification: "Pending verification"'), "The payment status value should remain unchanged for filtering.");
});

test("payment status is based on submitted payments and the current due schedule", () => {
  const schedule = (dueDate, amountPaidSen = 0) => ({ id: dueDate, caseId: "case", sequence: 1, kind: "installment", dueDate, amountDueSen: 10000, amountPaidSen, status: amountPaidSen === 10000 ? "paid" : amountPaidSen ? "partially_paid" : "scheduled" });
  assert.equal(derivePaymentStatus({ paymentSchedules: [schedule("2026-10-07")], payments: [] }, "2026-09-08"), "current");
  assert.equal(derivePaymentStatus({ paymentSchedules: [schedule("2026-09-07")], payments: [] }, "2026-09-08"), "overdue");
  assert.equal(derivePaymentStatus({ paymentSchedules: [schedule("2026-09-08", 5000)], payments: [] }, "2026-09-08"), "partially_paid");
  assert.equal(derivePaymentStatus({ paymentSchedules: [schedule("2026-10-07")], payments: [{ status: "pending_verification" }] }, "2026-09-08"), "pending_verification");
  assert.equal(derivePaymentStatus({ paymentSchedules: [schedule("2026-09-07", 10000)], payments: [] }, "2026-09-08"), "fully_paid");
});

test("case, status, and payment status headers are not sortable", () => {
  assert.ok(!queueSource.includes("<label><span>Sort by</span>"), "The cases table should not depend on the sort dropdown.");
  assert.ok(tableSource.includes("aria-sort={config?.ariaSort}"), "Sortable headers should expose their current direction.");
  assert.ok(queueSource.includes("onClick={() => updateSort(key)}"), "Other sortable headers should still update the active sort when clicked.");
  assert.ok(!queueSource.includes('sortableHeader("case", "Case")'), "Case should not be sortable.");
  assert.ok(!queueSource.includes('sortableHeader("status", "Status")'), "Status should not be sortable.");
  assert.ok(!queueSource.includes('sortableHeader("payment_status", "Payment Status")'), "Payment Status should not be sortable.");
});

test("case repository sorting remains available for clickable table headers", async () => {
  const result = await mockCasesRepository.listPage(staff, { page: 1, pageSize: 100, sortBy: "amount", sortDirection: "asc" });
  assert.equal(result.ok, true);
  const amounts = result.data.items.map((item) => item.saleAmountSen ?? 0);
  assert.deepEqual(amounts, [...amounts].sort((left, right) => left - right));
});

test("case workspace exposes the six-stage tracker and keeps detailed status handling", () => {
  for (const stage of [
    "Customer Details",
    "Admin Review & Quotation",
    "Bank Downpayment & Signed Proposal",
    "Installation",
    "Post-Installation Payment",
    "Recurring Balance",
  ]) assert.ok(workflowSource.includes(stage), `The case tracker must include ${stage}.`);
  assert.ok(workspaceSource.includes("getCaseFlowStageIndex(caseDetail.status)"), "The tracker must derive its current stage from the detailed status.");
});

test("case documents use the preview component with download and new-tab actions", () => {
  assert.ok(workspaceSource.includes("previewTimelineDocument(document)"), "Document actions must open the preview popup.");
  assert.ok(workspaceSource.includes("documentPreviewAccess"), "The case workspace must manage document preview access.");
  assert.ok(workspaceSource.includes(">Download"), "The reusable preview component must offer document downloads.");
  assert.ok(workspaceSource.includes("Open in new tab"), "The reusable preview component must offer a new-tab action.");
  assert.ok(workspaceSource.includes("headerActions={documentPreviewAccess"), "Preview actions must sit beside the modal close control.");
  assert.ok(iconsSource.includes("download:"), "The download action must use the shared icon set.");
  assert.ok(iconsSource.includes('"external-link"'), "The new-tab action must use the shared icon set.");
  assert.ok(!workspaceSource.includes('generateDocument("receipt"'), "The case workspace must not expose new receipt generation.");
  assert.ok(!workspaceSource.includes("Generate Receipt"), "Receipt generation actions must be removed from the case workspace.");
});

test("case workspace wires savings verification to exactly three readings", () => {
  assert.ok(workspaceSource.includes("const emptySavingsReadings = (): SavingsReadingDraft[] => Array.from({ length: 3 }"));
  assert.ok(workspaceSource.includes("if (drafts.length !== 3) return null"));
  assert.ok(workspaceSource.includes("verifySavings(user, caseDetail.id, { readings })"));
  assert.ok(workspaceSource.includes("caseDetail.verifiedSavings.readings.map"));
});

test("case workspace offers invoice generation per active schedule row", () => {
  assert.ok(workspaceSource.includes("activeInvoiceScheduleIds"), "Invoice candidates must be derived from payment schedules without issued invoices.");
  assert.ok(workspaceSource.includes('generateDocument("proforma", schedule.id)'), "The existing financial-document repository method must be used for schedule invoices.");
  assert.ok(workspaceSource.includes("canGenerateInvoice"), "Invoice generation must be permission-gated to the submitting agent or staff/admin.");
  assert.ok(workspaceSource.includes("<Badge status={schedule.status} />"), "Payment schedule badges must reflect the schedule status instead of assuming every unpaid schedule is pending verification.");
});
