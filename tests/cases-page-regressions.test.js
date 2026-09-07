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
const tableSource = fs.readFileSync(path.resolve(__dirname, "../components/data-table.tsx"), "utf8");
const typesSource = fs.readFileSync(path.resolve(__dirname, "../lib/types.ts"), "utf8");
const { mockCasesRepository } = require(path.resolve(__dirname, "../lib/case-repository.ts"));

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

test("case table exposes clickable sortable column headers instead of a sort dropdown", () => {
  assert.ok(!queueSource.includes("<label><span>Sort by</span>"), "The cases table should not depend on the sort dropdown.");
  assert.ok(tableSource.includes("aria-sort={config?.ariaSort}"), "Sortable headers should expose their current direction.");
  assert.ok(queueSource.includes("onClick={() => updateSort(key)}"), "Sortable headers should update the active sort when clicked.");
});

test("case repository sorting remains available for clickable table headers", async () => {
  const result = await mockCasesRepository.listPage(staff, { page: 1, pageSize: 100, sortBy: "amount", sortDirection: "asc" });
  assert.equal(result.ok, true);
  const amounts = result.data.items.map((item) => item.saleAmountSen ?? 0);
  assert.deepEqual(amounts, [...amounts].sort((left, right) => left - right));
});
