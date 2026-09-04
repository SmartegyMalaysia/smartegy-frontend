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

const invitation = require(path.resolve(__dirname, "../lib/staff-invitation.ts"));

test("staff invitation requires identity and a matching password", () => {
  const errors = invitation.validateStaffInvitation({ displayName: "", email: "staff@example.com", phone: "", password: "short", confirmation: "different" });
  assert.ok(errors.displayName);
  assert.ok(errors.password);
  assert.ok(errors.confirmation);
});

test("staff invitation accepts complete profile details", () => {
  const errors = invitation.validateStaffInvitation({ displayName: "Nur Aisyah", email: "staff@example.com", phone: "+60 12-345 6789", password: "secure-password", confirmation: "secure-password" });
  assert.deepEqual(errors, {});
});
