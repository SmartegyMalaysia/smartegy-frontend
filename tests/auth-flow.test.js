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

const auth = require(path.resolve(__dirname, "../lib/auth-repository.ts"));

test.beforeEach(() => auth.resetMockPasswordState());

test("forgot-password returns the same neutral response for any valid-looking email", async () => {
  const registered = await auth.requestPasswordReset("person@example.com");
  auth.resetMockPasswordState();
  const unknown = await auth.requestPasswordReset("unknown@example.com");
  assert.equal(registered.ok, true);
  assert.equal(unknown.ok, true);
  assert.equal(registered.message, unknown.message);
  assert.match(registered.message, /If an account exists/);
});

test("invalid email is rejected and repeated requests receive cooldown feedback", async () => {
  const invalid = await auth.requestPasswordReset("not-an-email");
  assert.equal(invalid.ok, false);
  const first = await auth.requestPasswordReset("person@example.com");
  const second = await auth.requestPasswordReset("person@example.com");
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.ok(second.cooldownSeconds > 0);
});

test("valid reset updates the password and prevents token reuse", async () => {
  const request = await auth.requestPasswordReset("person@example.com");
  const reset = await auth.resetPassword("mock-valid", "new-password", "new-password");
  const reused = await auth.resetPassword("mock-valid", "another-password", "another-password");
  assert.equal(request.ok, true);
  assert.equal(reset.ok, true);
  assert.equal(reused.ok, false);
  assert.equal(reused.code, "USED_LINK");
});

test("reset validates password policy and confirmation", async () => {
  await auth.requestPasswordReset("person@example.com");
  const short = await auth.resetPassword("mock-valid", "short", "short");
  assert.equal(short.ok, false);
  assert.equal(short.fieldErrors.password[0], "Use at least 8 characters.");
  const mismatch = await auth.resetPassword("mock-valid", "long-enough", "different");
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.fieldErrors.confirmation[0], "Passwords do not match.");
});

test("invalid and expired reset links are rejected", async () => {
  const invalid = await auth.resetPassword("unknown-token", "new-password", "new-password");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "INVALID_LINK");
  await auth.requestPasswordReset("person@example.com");
  auth.expireMockPasswordResetForTest();
  const expired = await auth.resetPassword("mock-valid", "new-password", "new-password");
  assert.equal(expired.ok, false);
  assert.equal(expired.code, "EXPIRED_LINK");
});
