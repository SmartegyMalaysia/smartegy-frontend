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

const { aggregateCommissionRows } = require(path.resolve(__dirname, "../lib/commission-aggregation.ts"));

function addMonths(date, months) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
}

function row(kind, installmentNo, amount, status, dueDate) {
  return { id: `${kind}-${installmentNo ?? "first"}`, case_id: "case-001", agent_id: "agent-001", case_number: "SMG-00124", customer_name: "Kencana Packaging Sdn Bhd", intended_level: "level_1", kind, installment_no: installmentNo, due_date: dueDate, amount, status, paid_at: status === "paid" ? `${dueDate}T09:00:00Z` : null, bank_reference: status === "paid" ? "BANK-001" : null };
}

test("commission ledger rows aggregate into one recipient record with the full deferred schedule", () => {
  const rows = [row("initial", null, 1048.32, "paid", "2026-07-31")];
  for (let sequence = 1; sequence <= 17; sequence += 1) rows.push(row("deferred", sequence, sequence === 17 ? 17.58 : 17.60, "scheduled", addMonths("2026-07-31", sequence + 1)));

  const [record] = aggregateCommissionRows(rows);
  assert.equal(record.entitlementSen, 134750);
  assert.equal(record.firstPaymentSen, 104832);
  assert.equal(record.deferredBalanceSen, 29918);
  assert.equal(record.paidToDateSen, 104832);
  assert.equal(record.schedule.length, 17);
  assert.equal(record.schedule[0].amountSen, 1760);
  assert.equal(record.schedule[16].amountSen, 1758);
  assert.deepEqual(record.paymentKinds, ["initial", "deferred"]);
});
