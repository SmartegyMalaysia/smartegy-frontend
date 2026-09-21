const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const controls = read("components/form-controls.tsx");
const login = read("components/login-page.tsx");
const signup = read("components/registration-signup.tsx");
const reset = read("components/auth-pages.tsx");
const invitation = read("components/staff-invitation-page.tsx");

test("all password forms use the shared PasswordField control", () => {
  for (const [name, source] of [["login", login], ["signup", signup], ["reset", reset], ["staff invitation", invitation]]) {
    assert.ok(source.includes("<PasswordField"), `${name} should use PasswordField.`);
    assert.ok(!source.includes('type="password"'), `${name} should not implement a separate password input.`);
  }
});

test("PasswordField provides consistent accessible visibility and validation behavior", () => {
  assert.ok(controls.includes('type={visible ? "text" : "password"}'));
  assert.ok(controls.includes('aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}'));
  assert.ok(controls.includes("aria-pressed={visible}"));
  assert.ok(controls.includes("<label htmlFor={id}>"));
  assert.ok(controls.includes("aria-invalid={Boolean(errorMessage)}"));
  assert.ok(controls.includes('className="field-error" role="alert"'));
});

test("password forms declare the appropriate browser autocomplete purpose", () => {
  assert.ok(login.includes('autoComplete="current-password"'));
  for (const source of [signup, reset, invitation]) assert.ok(source.includes('autoComplete="new-password"'));
});
