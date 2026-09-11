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
const months = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"];
const readings = months.map((month, index) => ({
  sequence: index + 1,
  month,
  tnbRate: 0,
  kwhUsed: 26000,
  billAmountSen: 1300000,
  operationDays: calculations.calendarDaysForMonth(month),
}));

test("calendar days include leap years and only completed months are selectable", () => {
  assert.equal(calculations.calendarDaysForMonth("2024-02"), 29);
  assert.equal(calculations.calendarDaysForMonth("2025-02"), 28);
  assert.equal(calculations.calendarDaysForMonth("2025-04"), 30);
  assert.equal(calculations.isCompletedHistoricalMonth("2026-08", new Date(2026, 8, 9)), true);
  assert.equal(calculations.isCompletedHistoricalMonth("2026-09", new Date(2026, 8, 9)), false);
});

test("empty proposal readings start with one blank row", () => {
  assert.equal(calculations.emptyProposalReadings().length, 1);
  assert.equal(calculations.emptyProposalReadings()[0].month, "");
});

test("proposal preview accepts one through twelve rows and derives rate from bill and kWh", () => {
  const preview = calculations.calculateProposalPreview({ saleAmountSen: 2450000, readings: [readings[0]] });
  assert.ok(preview);
  assert.equal(preview.avgRate, 0.5);
  assert.equal(preview.avgBillSen, 1300000);
  assert.equal(preview.calculatedDownpaymentSen, 104000);

  const twelveRowPreview = calculations.calculateProposalPreview({ saleAmountSen: 2450000, readings });
  assert.ok(twelveRowPreview);
  assert.equal(twelveRowPreview.savingRmMonthSen, 104000);
});

test("downpayment uses the highest bill and post-installation is twice the final amount", () => {
  const variedReadings = [
    { ...readings[0], billAmountSen: 1000000 },
    { ...readings[1], billAmountSen: 2500000 },
  ];
  const preview = calculations.calculateProposalPreview({ saleAmountSen: 6000000, readings: variedReadings });
  assert.ok(preview);
  assert.equal(preview.calculatedDownpaymentSen, 200000);
  assert.equal(preview.downpaymentSen, 200000);
  assert.equal(preview.postInstallationSen, 400000);
  assert.equal(preview.deposit1Sen, 200000);
  assert.equal(preview.deposit2Sen, 400000);
});

test("editable downpayment changes the initial payments and recurring totals", () => {
  const preview = calculations.calculateProposalPreview({ saleAmountSen: 2450000, downpaymentSen: 200000, readings });
  assert.ok(preview);
  assert.equal(preview.calculatedDownpaymentSen, 104000);
  assert.equal(preview.downpaymentSen, 200000);
  assert.equal(preview.postInstallationSen, 400000);
  assert.equal(preview.balanceSen, 1850000);
  assert.equal(preview.financingInterestSen, 245000);
  assert.equal(preview.option1TotalSen, 1850000);
  assert.equal(preview.option2TotalSen, 2095000);
  assert.equal(preview.option1MonthlySen, 185000);
  assert.equal(preview.option2MonthlySen, 104750);
});

test("twenty-month interest is calculated from the original project amount", () => {
  const preview = calculations.calculateProposalPreview({ saleAmountSen: 10000000, readings: [readings[0]] });
  assert.ok(preview);
  assert.equal(preview.calculatedDownpaymentSen, 104000);
  assert.equal(preview.postInstallationSen, 208000);
  assert.equal(preview.financingInterestSen, 1000000);
  assert.equal(preview.option1TotalSen, 9688000);
  assert.equal(preview.option2TotalSen, 10688000);
  assert.equal(preview.option2MonthlySen, 534400);
});

test("proposal preview rejects duplicate, future, empty, and out-of-range reading sets", () => {
  assert.equal(calculations.calculateProposalPreview({ saleAmountSen: 2450000, readings: [{ ...readings[0], month: "2025-01" }, { ...readings[1], month: "2025-01" }] }), null);
  assert.equal(calculations.calculateProposalPreview({ saleAmountSen: 2450000, readings: [{ ...readings[0], month: "2026-09" }] }), null);
  assert.equal(calculations.calculateProposalPreview({ saleAmountSen: 2450000, readings: [{ ...readings[0], operationDays: 30 }] }), null);
  assert.equal(calculations.calculateProposalPreview({ saleAmountSen: 2450000, readings: Array.from({ length: 13 }, (_, index) => ({ ...readings[0], sequence: index + 1, month: `2024-${String(index + 1).padStart(2, "0")}` })) }), null);
});

test("proposal drafts accept a project value below the former commission floor", async () => {
  const result = await mockCasesRepository.saveProposalDraft(staff, "case-004", {
    salesRepName: "Test Staff",
    proposalDate: "2026-09-08",
    saleAmountSen: 1500000,
    readings,
  });
  assert.equal(result.ok, true);
});
