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

const repository = require(path.resolve(__dirname, "../lib/agent-repository.ts"));
const staff = { id: "staff-001", role: "staff", displayName: "Staff User", email: "staff@smartegy.example", agentId: null };
const admin = { id: "admin-001", role: "admin", displayName: "Admin User", email: "admin@smartegy.example", agentId: null };
const agent = { id: "user-001", role: "agent", displayName: "Aisha Rahman", email: "aisha@smartegy.example", agentId: "agent-001" };

test("staff can list all agents with qualification data while agents cannot", async () => {
  repository.resetMockAgents();
  const result = await repository.agentRepository.list(staff);
  assert.equal(result.ok, true);
  assert.ok(result.data.length >= 4);
  assert.equal(result.data.find((item) => item.id === "agent-004").qualification.eligibleForPromotion, true);
  const forbidden = await repository.agentRepository.list(agent);
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error.code, "FORBIDDEN");
});

test("staff can view an agent's sales, commissions, upline chain, and direct downline", async () => {
  repository.resetMockAgents();
  const result = await repository.agentRepository.getById(staff, "agent-001");
  assert.equal(result.ok, true);
  assert.equal(result.data.agent.displayName, "Aisha Rahman");
  assert.ok(result.data.sales.length > 0);
  assert.ok(result.data.commissions.length > 0);
  assert.equal(result.data.uplineAgents.length, 0);
  assert.equal(result.data.downlineAgents.length, 3);
  const child = await repository.agentRepository.getById(staff, "agent-002");
  assert.equal(child.ok, true);
  assert.equal(child.data.uplineAgents[0].id, "agent-001");
  const forbidden = await repository.agentRepository.getById(agent, "agent-001");
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error.code, "FORBIDDEN");
});

test("staff requests require admin approval before a level changes and create an audit entry", async () => {
  repository.resetMockAgents();
  const requested = await repository.agentRepository.requestLevelChange(staff, { agentId: "agent-004", direction: "promote", reason: "Qualification reviewed." });
  assert.equal(requested.ok, true);
  assert.equal(requested.data.currentLevel, 1);
  assert.equal(requested.data.levelChangeRequests[0].status, "pending");
  const reviewed = await repository.agentRepository.reviewLevelChange(admin, { agentId: "agent-004", requestId: requested.data.levelChangeRequests[0].id, decision: "approve" });
  assert.equal(reviewed.ok, true);
  assert.equal(reviewed.data.currentLevel, 2);
  assert.equal(reviewed.data.qualification.nextLevel, 3);
  assert.equal(reviewed.data.promotionHistory.length, 1);
  assert.equal(reviewed.data.promotionHistory[0].previousLevel, 1);
  assert.equal(reviewed.data.promotionHistory[0].newLevel, 2);
  assert.equal(reviewed.data.promotionHistory[0].actorId, admin.id);
  const blocked = await repository.agentRepository.requestLevelChange(staff, { agentId: "agent-002", direction: "promote" });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error.code, "NOT_ELIGIBLE");
});

test("agents cannot request changes and staff cannot approve them", async () => {
  repository.resetMockAgents();
  const result = await repository.agentRepository.requestLevelChange(agent, { agentId: "agent-004", direction: "promote" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "FORBIDDEN");
  const request = await repository.agentRepository.requestLevelChange(staff, { agentId: "agent-004", direction: "promote" });
  const staffReview = await repository.agentRepository.reviewLevelChange(staff, { agentId: "agent-004", requestId: request.data.levelChangeRequests[0].id, decision: "reject" });
  assert.equal(staffReview.ok, false);
  assert.equal(staffReview.error.code, "FORBIDDEN");
});

test("only administrators can list level-change approvals", async () => {
  repository.resetMockAgents();
  const requested = await repository.agentRepository.requestLevelChange(staff, { agentId: "agent-004", direction: "promote" });
  const approvals = await repository.agentRepository.listLevelChangeApprovals(admin);
  assert.equal(approvals.ok, true);
  assert.equal(approvals.data[0].id, requested.data.levelChangeRequests[0].id);
  assert.equal(approvals.data[0].agent.agentCode, "AG-004");
  const forbidden = await repository.agentRepository.listLevelChangeApprovals(staff);
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error.code, "FORBIDDEN");
});
