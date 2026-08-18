const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  module._compile(output, filename);
};

const repository = require(path.resolve(__dirname, "../lib/case-repository.ts"));
const workflow = require(path.resolve(__dirname, "../lib/case-workflow.ts"));
const staff = { id: "user-002", role: "staff", displayName: "Farid Iskandar", email: "farid@smartegy.example", agentId: null };
const admin = { id: "user-003", role: "admin", displayName: "Mei Tan", email: "mei@smartegy.example", agentId: null };
const agent = { id: "user-001", role: "agent", displayName: "Aisha Rahman", email: "aisha@smartegy.example", agentId: "agent-001" };
const case004Agent = { id: "user-004", role: "agent", displayName: "Nadia Yusuf", email: "nadia@smartegy.example", agentId: "agent-003" };

test("case action visibility gives staff and admin the same normal processing actions", () => {
  assert.deepEqual(workflow.caseActionLabels("under_review", "staff"), workflow.caseActionLabels("under_review", "admin"));
  assert.ok(workflow.caseActionLabels("under_review", "staff").some((action) => action.label === "Request changes" && action.requiresReason));
  assert.equal(workflow.caseActionLabels("changes_requested", "agent")[0].label, "Resubmit for review");
  assert.equal(workflow.caseActionLabels("completed", "staff").length, 0);
});

test("request changes requires a reason and agents can edit and resubmit", async () => {
  const started = await repository.mockCasesRepository.transition(staff, "case-004", "under_review");
  assert.equal(started.ok, true);
  const missingReason = await repository.mockCasesRepository.requestChanges(staff, "case-004", "");
  assert.equal(missingReason.ok, false);
  const requested = await repository.mockCasesRepository.requestChanges(staff, "case-004", "Upload a clearer electricity bill.");
  assert.equal(requested.ok, true);
  assert.equal(requested.data.status, "changes_requested");
  const updated = await repository.mockCasesRepository.update(case004Agent, "case-004", { customer: { contactName: "Updated contact" } });
  assert.equal(updated.ok, true);
  const resubmitted = await repository.mockCasesRepository.transition(case004Agent, "case-004", "under_review");
  assert.equal(resubmitted.ok, true);
  assert.equal(resubmitted.data.status, "under_review");
});

test("operational prerequisites lead to one commission calculation and block premature completion", async () => {
  let result = await repository.mockCasesRepository.transition(staff, "case-002", "quotation_issued");
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.generatePaymentSchedule(staff, "case-002", { depositDue: "2026-08-20", postInstallationDue: "2026-08-25" });
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.transition(staff, "case-002", "awaiting_deposit");
  assert.equal(result.ok, true);
  const deposit = await repository.mockCasesRepository.recordPayment(staff, "case-002", { amountSen: 1000, paymentDate: "2026-08-20" });
  assert.equal(deposit.ok, true);
  result = await repository.mockCasesRepository.verifyPayment(staff, { paymentId: deposit.data.payments[0].id, allocations: [{ scheduleId: deposit.data.paymentSchedules[0].id, amountSen: 1000 }] });
  assert.equal(result.ok, true);
  const postInstall = await repository.mockCasesRepository.recordPayment(staff, "case-002", { amountSen: 2000, paymentDate: "2026-08-25" });
  result = await repository.mockCasesRepository.verifyPayment(staff, { paymentId: postInstall.data.payments[1].id, allocations: [{ scheduleId: postInstall.data.paymentSchedules[1].id, amountSen: 2000 }] });
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.transition(staff, "case-002", "installation_scheduled");
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.recordInstallation(staff, "case-002", "2026-09-01");
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.verifySavings(staff, "case-002", 2500, 7500);
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.transition(staff, "case-002", "trial_review");
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.acceptTrial(admin, "case-002", { installmentStart: "2026-10-01", termMonths: 10 });
  assert.equal(result.ok, true);
  assert.equal(result.data.status, "active_installments");
  assert.equal(result.data.commissionIds.length, 1);
  const incomplete = await repository.mockCasesRepository.transition(staff, "case-002", "completed");
  assert.equal(incomplete.ok, false);
});

test("cancellation requires a reason and is irreversible", async () => {
  const missingReason = await repository.mockCasesRepository.cancel(staff, "case-003", " ");
  assert.equal(missingReason.ok, false);
  const cancelled = await repository.mockCasesRepository.cancel(staff, "case-003", "Customer withdrew before installation.");
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.data.status, "cancelled");
  const retry = await repository.mockCasesRepository.transition(staff, "case-003", "under_review");
  assert.equal(retry.ok, false);
});
