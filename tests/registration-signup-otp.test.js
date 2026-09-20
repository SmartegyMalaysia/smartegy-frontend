const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.resolve(__dirname, "../components/registration-signup.tsx"),
  "utf8",
);

test("signup actions expose loading feedback and disable duplicate submissions", () => {
  assert.match(source, /registration-submit[\s\S]*aria-busy=\{submitting\}/);
  assert.match(source, /button-spinner/);
  assert.match(source, /disabled=\{resendCooldown > 0 \|\| submitting\}/);
  assert.match(source, /Sending code…/);
});

test("signup resend uses the backend cooldown and handles rate-limit responses", () => {
  assert.match(source, /const resendCooldownSeconds = 15/);
  assert.match(source, /httpStatus === 429/);
  assert.match(source, /after\\s\+\(\\d\+\)\\s\+seconds/);
  assert.match(source, /setResendCooldown\(resendCooldownSeconds\)/);
});

test("signup OTP UI uses code wording", () => {
  assert.match(source, /verification code sent/);
  assert.doesNotMatch(source, /Enter the 6-digit token/);
});
