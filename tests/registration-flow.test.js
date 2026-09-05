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

const repository = require(path.resolve(__dirname, "../lib/registration-repository.ts"));
const staff = { id: "staff-test", role: "staff", displayName: "Test Staff", email: "staff@example.com", agentId: null };

function applicant(id) {
  return { id: `user-${id}`, role: "agent", displayName: "Test Applicant", email: "test@example.com", agentId: id };
}

test.beforeEach(() => repository.resetMockRegistrations());

test("mock OTP verification gates application creation and accepts proof without applicant date or reference", async () => {
  const sent = await repository.registrationRepository.sendEmailOtp("new@example.com");
  assert.equal(sent.ok, true);
  const invalidOtp = await repository.registrationRepository.verifyEmailOtp("new@example.com", "000000");
  assert.equal(invalidOtp.ok, false);
  const verified = await repository.registrationRepository.verifyEmailOtp("new@example.com", "123456");
  assert.equal(verified.ok, true);
  const created = await repository.registrationRepository.createApplication({ fullName: "New Applicant", email: "new@example.com", mobileNumber: "+60123456789", password: "password123", passwordConfirmation: "password123", referralCode: "K7Q2M8", acceptedTerms: true });
  const submitted = await repository.registrationRepository.submitFee(applicant(created.data.id), { registrationId: created.data.id, paymentDate: null, paymentReference: null, paymentRemarks: "Paid via online banking", proof: { fileName: "proof.png", mimeType: "image/png", sizeBytes: 1200 } });
  assert.equal(submitted.ok, true);
  assert.equal(submitted.data.paymentDate, null);
  assert.equal(submitted.data.paymentRemarks, "Paid via online banking");
});

test("valid invitation signup locks the confirmed upline and invalid codes fail", async () => {
  const invitation = await repository.registrationRepository.getInvitation("K7Q2M8");
  assert.equal(invitation.ok, true);
  const created = await repository.registrationRepository.createApplication({ fullName: "Test Applicant", email: "test@example.com", mobileNumber: "+60123456789", password: "password123", passwordConfirmation: "password123", referralCode: "K7Q2M8", acceptedTerms: true });
  assert.equal(created.ok, true);
  assert.equal(created.data.referringAgentName, "Aisha Rahman");
  assert.equal(created.data.referralCode, "K7Q2M8");
  const invalid = await repository.registrationRepository.getInvitation("NOT-VALID");
  assert.equal(invalid.ok, false);
  const mismatched = await repository.registrationRepository.createApplication({ fullName: "Test Applicant", email: "test@example.com", mobileNumber: "+60123456789", password: "password123", passwordConfirmation: "different123", referralCode: "K7Q2M8", acceptedTerms: true });
  assert.equal(mismatched.ok, false);
  const invalidMobile = await repository.registrationRepository.createApplication({ fullName: "Test Applicant", email: "test@example.com", mobileNumber: "12345", password: "password123", passwordConfirmation: "password123", referralCode: "K7Q2M8", acceptedTerms: true });
  assert.equal(invalidMobile.ok, false);
  assert.deepEqual(invalidMobile.error.fieldErrors.mobileNumber, ["Enter a valid mobile number, for example 012345678."]);
});

test("pending applicant can load only their own registration status without a URL registration ID", async () => {
  const pendingApplicant = { id: "user-registration-001", role: "agent", displayName: "Nadia Yusuf", email: "nadia@smartegy.example", agentId: "registration-001" };
  const registration = await repository.registrationRepository.getRegistration(pendingApplicant, "");
  assert.equal(registration.ok, true);
  assert.equal(registration.data.registrationStatus, "pending_approval");
  assert.equal(registration.data.feeStatus, "pending_verification");
});

test("premature activation is blocked, self-verification is forbidden, and verified payment activates complete applications", async () => {
  const created = await repository.registrationRepository.createApplication({ fullName: "Test Applicant", email: "test@example.com", mobileNumber: "+60123456789", password: "password123", passwordConfirmation: "password123", referralCode: "K7Q2M8", acceptedTerms: true });
  const id = created.data.id;
  const actor = applicant(id);
  const premature = await repository.registrationRepository.approveRegistration(staff, { registrationId: id });
  assert.equal(premature.ok, false);
  const selfVerify = await repository.registrationRepository.verifyFee(actor, { registrationId: id, verifiedAmountSen: 5000, paymentDate: "2026-08-09", bankReference: "self" });
  assert.equal(selfVerify.ok, false);
  await repository.registrationRepository.verifyEmail(actor, id);
  await repository.registrationRepository.completeProfile(actor, id, { fullName: "Test Applicant", email: "test@example.com", mobileNumber: "+60123456789" });
  const submitted = await repository.registrationRepository.submitFee(actor, { registrationId: id, paymentDate: "2026-08-09", paymentReference: "SMG-REG-TEST", proof: { fileName: "proof.pdf", mimeType: "application/pdf", sizeBytes: 1000 } });
  assert.equal(submitted.data.feeStatus, "pending_verification");
  const verified = await repository.registrationRepository.verifyFee(staff, { registrationId: id, verifiedAmountSen: 5000, paymentDate: "2026-08-09", bankReference: "BANK-TEST" });
  assert.equal(verified.data.registrationStatus, "active");
  const activeAccess = await repository.registrationRepository.assertActiveAgent(actor, id);
  assert.equal(activeAccess.ok, true);
});

test("rejected proof can be resubmitted, but pending proof cannot be duplicated", async () => {
  const created = await repository.registrationRepository.createApplication({ fullName: "Test Applicant", email: "test@example.com", mobileNumber: "+60123456789", password: "password123", passwordConfirmation: "password123", referralCode: "K7Q2M8", acceptedTerms: true });
  const actor = applicant(created.data.id);
  const first = await repository.registrationRepository.submitFee(actor, { registrationId: created.data.id, paymentDate: "2026-08-09", paymentReference: "WRONG", proof: { fileName: "wrong.png", mimeType: "image/png", sizeBytes: 1000 } });
  assert.equal(first.data.feeStatus, "pending_verification");
  await repository.registrationRepository.rejectFee(staff, { registrationId: created.data.id, reason: "Proof is unreadable" });
  const resubmitted = await repository.registrationRepository.submitFee(actor, { registrationId: created.data.id, paymentDate: "2026-08-09", paymentReference: "CORRECT", proof: { fileName: "correct.png", mimeType: "image/png", sizeBytes: 1200 } });
  assert.equal(resubmitted.data.feeStatus, "pending_verification");
  const duplicate = await repository.registrationRepository.submitFee(actor, { registrationId: created.data.id, paymentDate: "2026-08-09", paymentReference: "DUPLICATE", proof: { fileName: "duplicate.png", mimeType: "image/png", sizeBytes: 1200 } });
  assert.equal(duplicate.ok, false);
  const missingReason = await repository.registrationRepository.rejectFee(staff, { registrationId: created.data.id, reason: "" });
  assert.equal(missingReason.ok, false);
  const missingRegistrationReason = await repository.registrationRepository.rejectRegistration(staff, { registrationId: created.data.id });
  assert.equal(missingRegistrationReason.ok, false);
});

test("agents cannot access the staff queue", async () => {
  const denied = await repository.registrationRepository.listForStaff(applicant("registration-001"));
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "FORBIDDEN");
});

test("staff registration queue supports search, priority sorting, and protected proof access", async () => {
  const queue = await repository.registrationRepository.listForStaff(staff, { search: "nadia", sort: "priority" });
  assert.equal(queue.ok, true);
  assert.equal(queue.data[0].applicationNumber, "SMG-REG-0001");
  const proof = await repository.registrationRepository.getPaymentProof(staff, "registration-001");
  assert.equal(proof.ok, true);
  assert.match(proof.data.accessToken, /^protected-proof-/);
  const denied = await repository.registrationRepository.getPaymentProof(applicant("registration-001"), "registration-001");
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "FORBIDDEN");
});

test("agent registration reads do not expose internal audit history", async () => {
  await repository.registrationRepository.verifyFee(staff, { registrationId: "registration-001", verifiedAmountSen: 5000, paymentDate: "2026-08-13", bankReference: "BANK-002", note: "Internal reconciliation note" });
  const view = await repository.registrationRepository.getRegistration(applicant("registration-001"), "registration-001");
  assert.equal(view.ok, true);
  assert.deepEqual(view.data.audit, []);
});

test("fee verification and activation create separate auditable status changes", async () => {
  const verified = await repository.registrationRepository.verifyFee(staff, { registrationId: "registration-001", verifiedAmountSen: 5000, paymentDate: "2026-08-13", bankReference: "BANK-001", note: "Matched bank statement" });
  assert.equal(verified.ok, true);
  assert.equal(verified.data.registrationStatus, "active");
  assert.equal(verified.data.feeStatus, "verified");
  assert.equal(verified.data.audit.some((event) => event.action === "payment_verified" && event.previousStatus === "pending_verification" && event.newStatus === "verified"), true);
  assert.equal(verified.data.audit.some((event) => event.action === "registration_approved"), true);
  assert.equal(verified.data.audit.some((event) => event.action === "agent_activated" && event.newStatus === "active"), true);
});
