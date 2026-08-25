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
  assert.ok(workflow.caseActionLabels("under_review", "staff").some((action) => action.label === "Request Changes" && action.requiresReason));
  const awaitingDeposit = workflow.caseActionLabels("awaiting_deposit", "staff");
  assert.ok(!awaitingDeposit.some((action) => action.label === "Record Deposit"));
  assert.ok(workflow.caseActionLabels("awaiting_deposit", "staff", true, false, true).some((action) => action.label === "Review Deposit"));
  assert.ok(workflow.caseActionLabels("awaiting_deposit", "agent", true, false, false).some((action) => action.label === "Record Deposit"));
  const depositPaid = workflow.caseActionLabels("awaiting_deposit", "staff", true, true);
  assert.ok(depositPaid.some((action) => action.label === "Set Installation Date"));
  assert.ok(workflow.caseActionLabels("installation_date_proposed", "agent").some((action) => action.label === "Confirm Installation Date"));
  assert.equal(workflow.caseActionLabels("changes_requested", "agent")[0].label, "Resubmit for Review");
  assert.ok(!workflow.caseActionLabels("completed", "staff").some((action) => action.label === "Delete Case"));
  assert.ok(workflow.caseActionLabels("draft", "agent").some((action) => action.label === "Delete Case"));
  assert.ok(!workflow.caseActionLabels("under_review", "agent").some((action) => action.label === "Delete Case"));
});

test("request changes requires a reason and agents can edit and resubmit", async () => {
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
  assert.equal(result.data.status, "awaiting_deposit");
  const deposit = await repository.mockCasesRepository.recordAndVerifyPayment(staff, "case-002", { amountSen: 1000, paymentDate: "2026-08-20" });
  assert.equal(deposit.ok, true);
  assert.equal(deposit.data.payments[0].status, "verified");
  assert.equal(deposit.data.paymentSchedules[0].amountPaidSen, 1000);
  const postInstall = await repository.mockCasesRepository.recordAndVerifyPayment(staff, "case-002", { amountSen: 2000, paymentDate: "2026-08-25" });
  result = postInstall;
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.proposeInstallationDate(staff, "case-002", "2026-08-28");
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.respondToInstallationDate(agent, "case-002", true);
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.recordInstallation(staff, "case-002", "2026-09-01");
  assert.equal(result.ok, false);
  result = await repository.mockCasesRepository.recordInstallation(staff, "case-002", "2026-08-28");
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
  const remainingInstallments = result.data.paymentSchedules.filter((schedule) => schedule.kind === "installment").reduce((sum, schedule) => sum + schedule.amountDueSen - schedule.amountPaidSen, 0);
  const finalPayment = await repository.mockCasesRepository.recordAndVerifyPayment(staff, "case-002", { amountSen: remainingInstallments, paymentDate: "2026-10-01" });
  assert.equal(finalPayment.ok, true);
  assert.equal(finalPayment.data.status, "completed");
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

test("quotation requires sale amount and quoted monthly savings", async () => {
  const result = await repository.mockCasesRepository.transition(staff, "case-004", "quotation_issued");
  assert.equal(result.ok, false);
  assert.equal(result.error.message, "Sale amount and quoted monthly savings are required before quotation.");
});

test("agent deposit submission requires staff verification and date confirmation", async () => {
  const created = await repository.mockCasesRepository.create(agent, {
    customer: { displayName: "Deposit Workflow Test", contactName: "Test Contact", email: "deposit@example.com", phone: "+60120000000" },
    service: { siteAddress: "1 Test Street", notes: "" },
    documents: [{ type: "electricity_bill", fileName: "bill.pdf", mimeType: "application/pdf", sizeBytes: 1200 }],
  });
  assert.equal(created.ok, true);
  const caseId = created.data.id;
  let result = await repository.mockCasesRepository.update(staff, caseId, { quote: { saleAmountSen: 100000, quotedMonthlySavingsSen: 1000 } });
  result = await repository.mockCasesRepository.transition(staff, caseId, "quotation_issued");
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.generatePaymentSchedule(staff, caseId, { depositDue: "2026-09-01", postInstallationDue: "2026-09-15" });
  assert.equal(result.ok, true);
  const depositSchedule = result.data.paymentSchedules.find((schedule) => schedule.kind === "deposit");
  const submitted = await repository.mockCasesRepository.submitDeposit(agent, caseId, { amountSen: depositSchedule.amountDueSen, paymentDate: "2026-08-26", reference: "AGENT-DEP-001" });
  assert.equal(submitted.ok, true);
  assert.equal(submitted.data.payments.at(-1).status, "pending_verification");
  assert.ok(!workflow.caseActionLabels("awaiting_deposit", "agent", true, false, true).some((action) => action.label === "Record Deposit"));
  const rejected = await repository.mockCasesRepository.rejectPayment(staff, { paymentId: submitted.data.payments.at(-1).id, reason: "Reference needs correction." });
  assert.equal(rejected.ok, true);
  const resubmitted = await repository.mockCasesRepository.submitDeposit(agent, caseId, { amountSen: depositSchedule.amountDueSen, paymentDate: "2026-08-26", reference: "AGENT-DEP-002" });
  assert.equal(resubmitted.ok, true);
  const pending = resubmitted.data.payments.find((payment) => payment.status === "pending_verification");
  const verified = await repository.mockCasesRepository.verifyPayment(staff, { paymentId: pending.id, allocations: [{ scheduleId: depositSchedule.id, amountSen: pending.amountSen }] });
  assert.equal(verified.ok, true);
  const proposed = await repository.mockCasesRepository.proposeInstallationDate(staff, caseId, "2026-09-20");
  assert.equal(proposed.data.status, "installation_date_proposed");
  const changeRequested = await repository.mockCasesRepository.respondToInstallationDate(agent, caseId, false, "Customer needs a weekday earlier in the month.");
  assert.equal(changeRequested.data.status, "installation_date_proposed");
  await repository.mockCasesRepository.proposeInstallationDate(staff, caseId, "2026-09-18");
  const confirmed = await repository.mockCasesRepository.respondToInstallationDate(agent, caseId, true);
  assert.equal(confirmed.data.status, "installation_scheduled");
  assert.equal(confirmed.data.installationDate, "2026-09-18");
});
