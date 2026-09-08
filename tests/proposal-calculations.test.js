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

test("proposal preview calculates payment values without a commission floor", () => {
  const preview = calculations.calculateProposalPreview({ saleAmountSen: 2450000, readings });
  assert.ok(preview);
  assert.equal(preview.savingRmMonthSen, 104000);
  assert.equal(preview.downpaymentTotalSen, 312000);
});

test("proposal drafts accept a project value below the former commission floor", async () => {
  const result = await mockCasesRepository.saveProposalDraft(staff, "case-004", {
    salesRepName: "Test Staff",
    proposalDate: "2026-09-08",
    saleAmountSen: 2450000,
    readings,
  });
  assert.equal(result.ok, true);
});
