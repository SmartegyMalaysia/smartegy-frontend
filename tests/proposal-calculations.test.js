const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  module._compile(output, filename);
};

const calculations = require(path.resolve(__dirname, "../lib/proposal-calculations.ts"));
const { mockCasesRepository } = require(path.resolve(__dirname, "../lib/case-repository.ts"));

const staff = { id: "user-002", role: "staff", displayName: "Test Staff", email: "staff@example.com", agentId: null };
const readings = Array.from({ length: 12 }, (_, index) => ({
  sequence: index + 1,
  month: `Month ${index + 1}`,
  tnbRate: 0.5,
  kwhUsed: 26000,
  billAmountSen: 1300000,
  operationDays: 30,
}));

test("proposal preview derives the minimum project value needed for non-negative commissions", () => {
  const preview = calculations.calculateProposalPreview({ saleAmountSen: 2450000, readings });
  assert.ok(preview);
  assert.equal(preview.savingRmMonthSen, 104000);
  assert.equal(preview.downpaymentTotalSen, 312000);
  assert.equal(preview.minimumSaleAmountSen, 1701819);
});

test("proposal drafts reject a project value below the commission floor", async () => {
  const result = await mockCasesRepository.saveProposalDraft(staff, "case-004", {
    salesRepName: "Test Staff",
    proposalDate: "2026-09-08",
    saleAmountSen: 1500000,
    readings,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(result.error.message, "Sale amount must be at least RM 17018.19 to prevent negative commissions.");
});
