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

const repository = require(path.resolve(__dirname, "../lib/bank-details-repository.ts"));
const firstLoginPage = fs.readFileSync(path.resolve(__dirname, "../components/first-login-bank-details.tsx"), "utf8");
const staff = { id: "user-002", role: "staff", displayName: "Farid Iskandar", email: "farid@smartegy.example", agentId: null };
const agent = { id: "user-001", role: "agent", displayName: "Aisha Rahman", email: "aisha@smartegy.example", agentId: "agent-001" };

test.beforeEach(() => repository.resetMockBankDetails());

test("first-login bank setup is a required, workspace-blocking form", () => {
  assert.ok(firstLoginPage.includes("Set Up Your Payout Details"));
  assert.ok(firstLoginPage.includes("Save And Continue"));
  assert.ok(firstLoginPage.includes("BANK_OPTIONS"));
});

test("staff users must save bank details before the mock workspace can continue", async () => {
  const missing = await repository.mockBankDetailsRepository.getMine(staff);
  assert.equal(missing.ok, true);
  assert.equal(missing.data, null);

  const invalid = await repository.mockBankDetailsRepository.updateMine(staff, { bankName: "", accountHolderName: "", accountNumber: "12" });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.error.fieldErrors.bankName);

  const saved = await repository.mockBankDetailsRepository.updateMine(staff, { bankName: "Maybank", accountHolderName: "Farid Iskandar", accountNumber: "1234567890" });
  assert.equal(saved.ok, true);
  assert.equal(saved.data.accountNumber, "1234567890");
  assert.deepEqual((await repository.mockBankDetailsRepository.getMine(staff)).data, saved.data);
});

test("agents use their existing payout bank-details source", async () => {
  const result = await repository.mockBankDetailsRepository.getMine(agent);
  assert.equal(result.ok, true);
  assert.equal(result.data.bankName, "Malayan Banking Berhad (Maybank)");
});
