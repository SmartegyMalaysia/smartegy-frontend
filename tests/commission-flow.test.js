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

const repository = require(path.resolve(__dirname, "../lib/commission-repository.ts"));
const agent = { id: "user-001", role: "agent", displayName: "Aisha Rahman", email: "aisha@smartegy.example", agentId: "agent-001" };
const otherAgent = { id: "user-002", role: "agent", displayName: "Daniel Lim", email: "daniel@smartegy.example", agentId: "agent-002" };
const staff = { id: "staff-001", role: "staff", displayName: "Staff User", email: "staff@smartegy.example", agentId: null };

test("agent can view only their own commission records and receives the full 17-month schedule", async () => {
  const list = await repository.mockAgentCommissionsRepository.list(agent);
  assert.equal(list.ok, true);
  assert.ok(list.data.length > 0);
  const detail = await repository.mockAgentCommissionsRepository.getById(agent, list.data[0].id);
  assert.equal(detail.ok, true);
  assert.equal(detail.data.schedule.length, 17);
  assert.equal(detail.data.schedule[0].sequence, 1);
  assert.equal(detail.data.schedule[16].sequence, 17);
  assert.equal(detail.data.schedule.filter((entry) => entry.status === "scheduled").length, 17);
});

test("agents cannot access another agent's commission or bypass role checks", async () => {
  const list = await repository.mockAgentCommissionsRepository.list(agent);
  assert.equal(list.ok, true);
  const other = await repository.mockAgentCommissionsRepository.getById(otherAgent, list.data[0].id);
  assert.equal(other.ok, false);
  assert.equal(other.error.code, "NOT_FOUND");
  const staffResult = await repository.mockAgentCommissionsRepository.list(staff);
  assert.equal(staffResult.ok, false);
  assert.equal(staffResult.error.code, "FORBIDDEN");
});

test("overview values come from the trusted commission repository", async () => {
  const overview = await repository.mockAgentCommissionsRepository.getOverview(agent);
  assert.equal(overview.ok, true);
  assert.equal(overview.data.totalEntitlementSen, 134750);
  assert.equal(overview.data.paidToDateSen, 104832);
  assert.equal(overview.data.remainingBalanceSen, 29918);
  assert.equal(overview.data.upcomingPayoutSen, 1759);
  assert.equal(overview.data.upcomingPayoutDate, "2026-09-15");
});
