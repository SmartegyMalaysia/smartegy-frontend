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
const agent = { id: "user-001", role: "agent", displayName: "Aisha Rahman", email: "aisha@smartegy.example", agentId: "agent-001" };
const otherAgent = { id: "user-002", role: "agent", displayName: "Daniel Lim", email: "daniel@smartegy.example", agentId: "agent-002" };

function input(documents) {
  return { customer: { displayName: "Test Customer", contactName: "Test Contact", email: "customer@example.com", phone: "012345678" }, service: { siteAddress: "12 Test Street", electricityAccountNumber: "ACC-123", notes: "Optional context" }, documents };
}

test("case submission requires the latest electricity bill", async () => {
  const result = await repository.mockCasesRepository.create(agent, input([]));
  assert.equal(result.ok, false);
  assert.deepEqual(result.error.fieldErrors.electricityBill, ["Upload the latest electricity bill before submitting."]);
});

test("agent can submit with only the required bill and stores its metadata", async () => {
  const result = await repository.mockCasesRepository.create(agent, input([{ type: "electricity_bill", fileName: "bill.pdf", mimeType: "application/pdf", sizeBytes: 1200 }]));
  assert.equal(result.ok, true);
  assert.equal(result.data.status, "submitted");
  assert.equal(result.data.documents.length, 1);
  assert.equal(result.data.documents[0].type, "electricity_bill");
});

test("agent can submit multiple optional supporting documents", async () => {
  const result = await repository.mockCasesRepository.create(agent, input([{ type: "electricity_bill", fileName: "bill.png", mimeType: "image/png", sizeBytes: 1200 }, { type: "supporting_document", fileName: "quote.pdf", mimeType: "application/pdf", sizeBytes: 1400 }, { type: "supporting_document", fileName: "notes.jpg", mimeType: "image/jpeg", sizeBytes: 1600 }]));
  assert.equal(result.ok, true);
  assert.equal(result.data.documents.length, 3);
});

test("invalid files are rejected and agents cannot access another agent's case", async () => {
  const invalid = await repository.mockCasesRepository.create(agent, input([{ type: "electricity_bill", fileName: "bill.exe", mimeType: "application/octet-stream", sizeBytes: 1200 }]));
  assert.equal(invalid.ok, false);
  const oversized = await repository.mockCasesRepository.create(agent, input([{ type: "electricity_bill", fileName: "large-bill.pdf", mimeType: "application/pdf", sizeBytes: 11 * 1024 * 1024 }]));
  assert.equal(oversized.ok, false);
  const created = await repository.mockCasesRepository.create(agent, input([{ type: "electricity_bill", fileName: "private.pdf", mimeType: "application/pdf", sizeBytes: 1200 }]));
  assert.equal(created.ok, true);
  const forbidden = await repository.mockCasesRepository.getById(otherAgent, created.data.id);
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error.code, "FORBIDDEN");
});
