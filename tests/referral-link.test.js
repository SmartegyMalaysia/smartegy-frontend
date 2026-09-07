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

const { resolveReferralCode } = require(path.resolve(__dirname, "../lib/referral-link.ts"));
const assert = require("node:assert/strict");

test("referral route resolves the generated code from async route params", () => {
  assert.equal(resolveReferralCode("K7Q2M8"), "K7Q2M8");
});

test("referral route decodes URL-encoded codes before autofill", () => {
  assert.equal(resolveReferralCode("K7Q2M8%2FTEST"), "K7Q2M8/TEST");
});
