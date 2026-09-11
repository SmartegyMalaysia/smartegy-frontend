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
  assert.ok(workflow.caseActionLabels("quotation_issued", "agent").some((action) => action.label === "Accept Proposal"));
  assert.ok(!workflow.caseActionLabels("quotation_issued", "staff").some((action) => action.label === "Accept Proposal"));
  assert.ok(!workflow.caseActionLabels("quotation_issued", "admin").some((action) => action.label === "Accept Proposal"));
  assert.ok(workflow.caseActionLabels("under_review", "staff").some((action) => action.label === "Request Changes" && action.requiresReason));
  const awaitingDeposit = workflow.caseActionLabels("awaiting_deposit_submission", "staff");
  assert.ok(!awaitingDeposit.some((action) => action.label === "Verify Deposit"));
  const pendingDeposit = workflow.caseActionLabels("deposit_pending_verification", "staff", true, false, true);
  assert.ok(pendingDeposit.some((action) => action.label === "Verify Deposit" && action.variant === "primary"));
  assert.ok(!awaitingDeposit.some((action) => action.label === "Set Installation Date"));
  const depositPaid = workflow.caseActionLabels("awaiting_installation_scheduling", "staff", true, true);
  assert.ok(!depositPaid.some((action) => action.kind === "submit_deposit"));
  assert.ok(depositPaid.some((action) => action.label === "Set Installation Date"));
  const agentPendingDeposit = workflow.caseActionLabels("deposit_pending_verification", "agent", true, false, true);
  assert.ok(!agentPendingDeposit.some((action) => action.label.includes("Verify")));
  const agentPartialDeposit = workflow.caseActionLabels("deposit_pending_verification", "agent", true, false, false);
  assert.ok(agentPartialDeposit.some((action) => action.label === "Record Another Downpayment"));
  const agentPartialPostInstallation = workflow.caseActionLabels("post_installation_payment_pending_verification", "agent", true, true, true, false, 120000, 200000);
  assert.ok(agentPartialPostInstallation.some((action) => action.label === "Record Another Post-Installation Payment"));
  const agentFullyPendingPostInstallation = workflow.caseActionLabels("post_installation_payment_pending_verification", "agent", true, true, true, false, 200000, 200000);
  assert.ok(!agentFullyPendingPostInstallation.some((action) => action.kind === "submit_post_installation_payment"));
  const staffAwaitingPostInstallation = workflow.caseActionLabels("awaiting_post_installation_payment", "staff", true, true);
  assert.ok(!staffAwaitingPostInstallation.some((action) => action.kind === "submit_post_installation_payment"));
  const staffPendingPostInstallation = workflow.caseActionLabels("post_installation_payment_pending_verification", "staff", true, true, true);
  assert.ok(staffPendingPostInstallation.some((action) => action.kind === "verify_payment"));
  assert.ok(!staffPendingPostInstallation.some((action) => action.kind === "submit_post_installation_payment"));
  assert.ok(workflow.caseActionLabels("active_installments", "agent", true, true, false).some((action) => action.label === "Record Installment Payment"));
  assert.ok(workflow.caseActionLabels("active_installments", "staff", true, true, true).some((action) => action.label === "Verify Installment Payment"));
  assert.ok(workflow.caseActionLabels("installed_monitoring", "agent").some((action) => action.kind === "verify_savings"));
  assert.ok(!workflow.caseActionLabels("installed_monitoring", "staff").some((action) => action.kind === "verify_savings"));
  assert.equal(workflow.caseActionLabels("changes_requested", "agent")[0].label, "Resubmit for Review");
  assert.ok(!workflow.caseActionLabels("completed", "staff").some((action) => action.label === "Delete Case"));
  assert.ok(workflow.caseActionLabels("draft", "agent").some((action) => action.label === "Delete Case"));
  assert.ok(!workflow.caseActionLabels("under_review", "agent").some((action) => action.label === "Delete Case"));
});

test("proposal acceptance is restricted to the submitting agent", async () => {
  const input = { acceptedByName: "Customer", acceptanceDate: "2026-09-07", depositDue: "2026-09-07", postInstallationDue: "2026-09-21", selectedTermMonths: 10, signedProposal: { name: "signed.pdf", type: "application/pdf", size: 100 } };
  const staffAttempt = await repository.mockCasesRepository.acceptProposal(staff, "case-001", input);
  assert.equal(staffAttempt.ok, false);
  assert.equal(staffAttempt.error.code, "FORBIDDEN");
  const otherAgentAttempt = await repository.mockCasesRepository.acceptProposal(case004Agent, "case-001", input);
  assert.equal(otherAgentAttempt.ok, false);
  assert.equal(otherAgentAttempt.error.code, "FORBIDDEN");
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
  assert.equal(result.data.status, "awaiting_deposit_submission");
  const depositSubmitted = await repository.mockCasesRepository.submitDeposit(agent, "case-002", { amountSen: 600, paymentDate: "2026-08-20", proof: { fileName: "deposit-1.png", mimeType: "image/png" } });
  assert.equal(depositSubmitted.ok, true);
  const agentVerifyAttempt = await repository.mockCasesRepository.verifyPayment(agent, { paymentId: depositSubmitted.data.payments[0].id, allocations: [{ scheduleId: depositSubmitted.data.paymentSchedules[0].id, amountSen: 1000 }] });
  assert.equal(agentVerifyAttempt.ok, false);
  assert.equal(agentVerifyAttempt.error.code, "FORBIDDEN");
  const secondDepositSubmitted = await repository.mockCasesRepository.submitDeposit(agent, "case-002", { amountSen: 400, paymentDate: "2026-08-21", proof: { fileName: "deposit-2.png", mimeType: "image/png" } });
  assert.equal(secondDepositSubmitted.ok, true);
  const deposit = await repository.mockCasesRepository.verifyPayment(staff, { paymentId: depositSubmitted.data.payments[0].id, allocations: [{ scheduleId: depositSubmitted.data.paymentSchedules[0].id, amountSen: 600 }] });
  assert.equal(deposit.ok, true);
  assert.equal(deposit.data.payments[0].status, "verified");
  assert.equal(deposit.data.paymentSchedules[0].amountPaidSen, 600);
  const completedDeposit = await repository.mockCasesRepository.verifyPayment(admin, { paymentId: secondDepositSubmitted.data.payments[1].id, allocations: [{ scheduleId: secondDepositSubmitted.data.paymentSchedules[0].id, amountSen: 400 }] });
  assert.equal(completedDeposit.ok, true);
  assert.equal(completedDeposit.data.paymentSchedules[0].amountPaidSen, 1000);
  assert.equal(result.ok, true);
  result = await repository.mockCasesRepository.proposeInstallationDate(staff, "case-002", "2026-09-01", "09:00");
  assert.equal(result.ok, true);
  assert.equal(result.data.status, "installation_pending_confirmation");
  result = await repository.mockCasesRepository.confirmInstallationDate(agent, "case-002");
  assert.equal(result.ok, true);
  assert.equal(result.data.status, "installation_scheduled");
  result = await repository.mockCasesRepository.recordInstallation(staff, "case-002", "2026-09-01", "09:00");
  assert.equal(result.ok, true);
  assert.equal(result.data.status, "awaiting_post_installation_payment");
  const postInstallationSchedule = result.data.paymentSchedules.find((schedule) => schedule.kind === "post_installation");
  const staffPostInstallationAttempt = await repository.mockCasesRepository.submitPostInstallationPayment(staff, "case-002", { amountSen: 2000, paymentDate: "2026-09-01", proof: { fileName: "post-installation-staff.png", mimeType: "image/png" } });
  assert.equal(staffPostInstallationAttempt.ok, false);
  assert.equal(staffPostInstallationAttempt.error.code, "FORBIDDEN");
  const firstPostInstallationPayment = await repository.mockCasesRepository.submitPostInstallationPayment(agent, "case-002", { amountSen: 1200, paymentDate: "2026-09-01", proof: { fileName: "post-installation-1.png", mimeType: "image/png" } });
  assert.equal(firstPostInstallationPayment.ok, true);
  assert.equal(firstPostInstallationPayment.data.status, "post_installation_payment_pending_verification");
  const secondPostInstallationPayment = await repository.mockCasesRepository.submitPostInstallationPayment(agent, "case-002", { amountSen: 800, paymentDate: "2026-09-02", proof: { fileName: "post-installation-2.png", mimeType: "image/png" } });
  assert.equal(secondPostInstallationPayment.ok, true);
  const postInstallationPayments = secondPostInstallationPayment.data.payments.filter((payment) => payment.status === "pending_verification");
  assert.equal(postInstallationPayments.length, 2);
  const firstPostInstallationVerification = await repository.mockCasesRepository.verifyPayment(staff, { paymentId: postInstallationPayments[0].id, allocations: [{ scheduleId: postInstallationSchedule.id, amountSen: 1200 }] });
  assert.equal(firstPostInstallationVerification.ok, true);
  assert.equal(firstPostInstallationVerification.data.status, "post_installation_payment_pending_verification");
  const completedPostInstallationPayment = await repository.mockCasesRepository.verifyPayment(admin, { paymentId: postInstallationPayments[1].id, allocations: [{ scheduleId: postInstallationSchedule.id, amountSen: 800 }] });
  assert.equal(completedPostInstallationPayment.ok, true);
  assert.equal(completedPostInstallationPayment.data.status, "installed_monitoring");
  result = completedPostInstallationPayment;
  result = await repository.mockCasesRepository.verifySavings(agent, "case-002", { readings: [
    { sequence: 1, month: "2026-06", tnbRate: 0.3, kwhUsed: 2500, billAmountSen: 75000, operationDays: 30, dailyKwh: 83.333 },
    { sequence: 2, month: "2026-07", tnbRate: 0.3, kwhUsed: 2500, billAmountSen: 75000, operationDays: 31, dailyKwh: 80.645 },
    { sequence: 3, month: "2026-08", tnbRate: 0.3, kwhUsed: 2500, billAmountSen: 75000, operationDays: 31, dailyKwh: 80.645 },
  ] });
  assert.equal(result.ok, true);
  assert.equal(result.data.status, "trial_review");
  result = await repository.mockCasesRepository.acceptTrial(admin, "case-002", { installmentStart: "2026-10-01", termMonths: 10 });
  assert.equal(result.ok, true);
  assert.equal(result.data.status, "active_installments");
  assert.equal(result.data.commissionIds.length, 1);
  const firstInstallment = result.data.paymentSchedules.find((schedule) => schedule.kind === "installment");
  const installmentSubmitted = await repository.mockCasesRepository.submitInstallmentPayment(agent, "case-002", { amountSen: firstInstallment.amountDueSen, paymentDate: "2026-10-01", proof: {} });
  assert.equal(installmentSubmitted.ok, true);
  const installmentVerified = await repository.mockCasesRepository.verifyPayment(admin, { paymentId: installmentSubmitted.data.payments.at(-1).id, allocations: [{ scheduleId: firstInstallment.id, amountSen: firstInstallment.amountDueSen }] });
  assert.equal(installmentVerified.ok, true);
  assert.equal(installmentVerified.data.status, "active_installments");
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
