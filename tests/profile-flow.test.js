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

const repository = require(path.resolve(__dirname, "../lib/profile-repository.ts"));
const own = { id: "user-001", role: "agent", displayName: "Aisha Rahman", email: "aisha@smartegy.example", agentId: "agent-001" };
const other = { id: "user-002", role: "agent", displayName: "Daniel Lim", email: "daniel@smartegy.example", agentId: "agent-002" };

test.beforeEach(() => repository.resetMockProfiles());

test("an agent can view only their own profile", async () => {
  const visible = await repository.agentProfileRepository.getMine(own);
  assert.equal(visible.ok, true);
  assert.equal(visible.data.agentNumber, "AG-001");
  const denied = await repository.agentProfileRepository.getMine(other);
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "NOT_FOUND");
});

test("name and mobile validation are enforced by the profile service", async () => {
  const invalid = await repository.agentProfileRepository.updateMine(own, { fullName: "", mobileNumber: "123", email: "aisha@smartegy.example" });
  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.error.fieldErrors.fullName, ["Enter your full name."]);
  assert.deepEqual(invalid.error.fieldErrors.mobileNumber, ["Enter a valid Malaysian mobile number."]);
});

test("email changes clear verification and protected fields are rejected", async () => {
  const changed = await repository.agentProfileRepository.updateMine(own, { fullName: "Aisha Rahman", mobileNumber: "+60123456789", email: "new@example.com" });
  assert.equal(changed.ok, true);
  assert.equal(changed.data.emailVerified, false);
  const sent = await repository.agentProfileRepository.requestEmailVerification(own);
  assert.equal(sent.ok, true);
  const verified = await repository.agentProfileRepository.verifyEmail(own, "123456");
  assert.equal(verified.ok, true);
  assert.equal(verified.data.emailVerified, true);
  const protectedChange = await repository.agentProfileRepository.updateMine(own, { fullName: "Aisha Rahman", mobileNumber: "+60123456789", email: "new@example.com", currentLevel: 3 });
  assert.equal(protectedChange.ok, false);
  assert.equal(protectedChange.error.code, "FORBIDDEN");
});

test("pending agent profile exposes restricted registration state", async () => {
  const pending = await repository.agentProfileRepository.getMine({ id: "user-registration-001", role: "agent", displayName: "Nadia Yusuf", email: "nadia@smartegy.example", agentId: "registration-001" });
  assert.equal(pending.ok, true);
  assert.equal(pending.data.registrationStatus, "pending_approval");
  assert.equal(pending.data.feeStatus, "pending_verification");
  assert.equal(pending.data.accountStatus, "inactive");
});
