const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const { resolveReferralCode, referralCodeForSubmission } = require(path.resolve(__dirname, "../lib/referral-link.ts"));
const assert = require("node:assert/strict");
const signupSource = fs.readFileSync(path.resolve(__dirname, "../components/registration-signup.tsx"), "utf8");

test("referral route resolves the generated code from async route params", () => {
  assert.equal(resolveReferralCode("K7Q2M8"), "K7Q2M8");
});

test("referral route decodes URL-encoded codes before autofill", () => {
  assert.equal(resolveReferralCode("K7Q2M8%2FTEST"), "K7Q2M8/TEST");
});

test("locked referral links submit the confirmed code instead of their display text", () => {
  assert.equal(referralCodeForSubmission("Confirmed from invitation link", "K7Q2M8"), "K7Q2M8");
  assert.equal(referralCodeForSubmission("  K7Q2M8  "), "K7Q2M8");
  assert.match(signupSource, /referralCodeForSubmission\(/);
  assert.doesNotMatch(signupSource, /value=\{referralLocked \? "Confirmed from invitation link"/);
});
