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

const repository = require(path.resolve(__dirname, "../lib/payout-repository.ts"));
const staff = { id: "staff-001", role: "staff", displayName: "Staff User", email: "staff@smartegy.example", agentId: null };
const admin = { id: "admin-001", role: "admin", displayName: "Admin User", email: "admin@smartegy.example", agentId: null };
const agent = { id: "user-001", role: "agent", displayName: "Aisha Rahman", email: "aisha@smartegy.example", agentId: "agent-001" };

test("staff and admin can view monthly payout totals while agents cannot", async () => {
  repository.resetMockPayouts();
  const staffResult = await repository.payoutRepository.getMonth(staff, "2026-09");
  assert.equal(staffResult.ok, true);
  assert.equal(staffResult.data.agentPayouts.length, 3);
  assert.equal(staffResult.data.summary.totalSen, 10117);
  assert.equal(staffResult.data.transactions[0].bankAccount.accountNumberMasked.includes("••••"), true);
  const adminResult = await repository.payoutRepository.getMonth(admin, "2026-09");
  assert.equal(adminResult.ok, true);
  const forbidden = await repository.payoutRepository.getMonth(agent, "2026-09");
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error.code, "FORBIDDEN");
});

test("staff can manually settle an individual payout with a bank reference", async () => {
  repository.resetMockPayouts();
  const settled = await repository.payoutRepository.settleTransaction(staff, { transactionId: "payout-001", bankReference: "MBB-SEP-001" });
  assert.equal(settled.ok, true);
  assert.equal(settled.data.settlementStatus, "settled");
  assert.equal(settled.data.bankReference, "MBB-SEP-001");
  assert.equal(settled.data.settledById, staff.id);
  assert.ok(settled.data.settledAt);
  const duplicate = await repository.payoutRepository.settleTransaction(admin, { transactionId: "payout-001", bankReference: "DUPLICATE" });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error.code, "CONFLICT");
});
