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

const repository = require(path.resolve(__dirname, "../lib/user-repository.ts"));
const admin = { id: "user-003", role: "admin", displayName: "Mei Tan", email: "mei@smartegy.example", agentId: null, accountStatus: "active" };
const staff = { id: "user-002", role: "staff", displayName: "Farid Iskandar", email: "farid@smartegy.example", agentId: null, accountStatus: "active" };

test("only administrators can list and update user accounts", async () => {
  repository.resetMockUsers();
  const listed = await repository.userRepository.list(admin);
  assert.equal(listed.ok, true);
  assert.ok(listed.data.length >= 7);
  const forbidden = await repository.userRepository.list(staff);
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error.code, "FORBIDDEN");
  const blocked = await repository.userRepository.update(admin, "user-005", { displayName: "Nadia Yusuf", phone: "+60 12-111 2222", role: "agent", accountStatus: "active" });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error.code, "CONFLICT");
  assert.match(blocked.error.message, /registration fee/i);
});

test("user updates validate required fields and protect the current administrator", async () => {
  repository.resetMockUsers();
  const invalid = await repository.userRepository.update(admin, "user-005", { displayName: " ", phone: "", role: "agent", accountStatus: "active" });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, "VALIDATION_ERROR");
  assert.ok(invalid.error.fieldErrors.displayName);
  const selfChange = await repository.userRepository.update(admin, admin.id, { displayName: "Mei Tan", phone: "", role: "staff", accountStatus: "active" });
  assert.equal(selfChange.ok, false);
  assert.equal(selfChange.error.code, "CONFLICT");
});

test("agent roles stay isolated while staff and admin roles can switch", async () => {
  repository.resetMockUsers();
  const agentToStaff = await repository.userRepository.update(admin, "user-001", { displayName: "Aisha Rahman", phone: "+60 12-345 6789", role: "staff", accountStatus: "active" });
  assert.equal(agentToStaff.ok, false);
  assert.equal(agentToStaff.error.code, "CONFLICT");
  assert.match(agentToStaff.error.message, /agent accounts cannot be converted/i);
  const staffToAgent = await repository.userRepository.update(admin, "user-002", { displayName: "Farid Iskandar", phone: "+60 13-210 7788", role: "agent", accountStatus: "active" });
  assert.equal(staffToAgent.ok, false);
  assert.equal(staffToAgent.error.code, "CONFLICT");
  const adminToAgent = await repository.userRepository.update(admin, "user-003", { displayName: "Mei Tan", phone: "+60 12-889 0042", role: "agent", accountStatus: "active" });
  assert.equal(adminToAgent.ok, false);
  assert.equal(adminToAgent.error.code, "CONFLICT");
  const staffToAdmin = await repository.userRepository.update(admin, "user-002", { displayName: "Farid Iskandar", phone: "+60 13-210 7788", role: "admin", accountStatus: "active" });
  assert.equal(staffToAdmin.ok, true);
  assert.equal(staffToAdmin.data.role, "admin");
  const anotherAdmin = { id: "admin-002", role: "admin", displayName: "Second Admin", email: "second.admin@smartegy.example", agentId: null, accountStatus: "active" };
  const adminToStaff = await repository.userRepository.update(anotherAdmin, "user-003", { displayName: "Mei Tan", phone: "+60 12-889 0042", role: "staff", accountStatus: "active" });
  assert.equal(adminToStaff.ok, true);
  assert.equal(adminToStaff.data.role, "staff");
});

test("only administrators can create invited staff accounts", async () => {
  repository.resetMockUsers();
  const forbidden = await repository.userRepository.createStaff(staff, { displayName: "New Staff", email: "new.staff@smartegy.example", phone: "" });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error.code, "FORBIDDEN");

  const created = await repository.userRepository.createStaff(admin, { displayName: "New Staff", email: "NEW.STAFF@smartegy.example", phone: "+60 12-000 0000" });
  assert.equal(created.ok, true);
  assert.equal(created.data.role, "staff");
  assert.equal(created.data.accountStatus, "invited");
  assert.equal(created.data.email, "new.staff@smartegy.example");

  const duplicate = await repository.userRepository.createStaff(admin, { displayName: "Duplicate", email: "new.staff@smartegy.example", phone: "" });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error.code, "CONFLICT");
  assert.ok(duplicate.error.fieldErrors.email);
});

test("user directory sorting respects both supported fields and directions", async () => {
  repository.resetMockUsers();
  const namesAscending = await repository.userRepository.listPage(admin, { page: 1, pageSize: 100, sortBy: "display_name", sortDirection: "asc" });
  const namesDescending = await repository.userRepository.listPage(admin, { page: 1, pageSize: 100, sortBy: "display_name", sortDirection: "desc" });
  const newestFirst = await repository.userRepository.listPage(admin, { page: 1, pageSize: 100, sortBy: "created_at", sortDirection: "desc" });

  assert.equal(namesAscending.ok, true);
  assert.equal(namesDescending.ok, true);
  assert.equal(newestFirst.ok, true);
  assert.deepEqual(namesDescending.data.items.map((item) => item.displayName), [...namesAscending.data.items.map((item) => item.displayName)].reverse());
  assert.deepEqual(newestFirst.data.items.map((item) => item.createdAt), [...newestFirst.data.items.map((item) => item.createdAt)].sort().reverse());
});

test("frontend normalizes RPC user order after the backend selects a page", () => {
  const items = [
    { id: "2", displayName: "Aisha", createdAt: "2026-01-01T00:00:00Z" },
    { id: "1", displayName: "Zara", createdAt: "2026-02-01T00:00:00Z" },
  ];
  assert.deepEqual(repository.sortUserDirectoryItems(items, "display_name", "desc").map((item) => item.displayName), ["Zara", "Aisha"]);
  assert.deepEqual(repository.sortUserDirectoryItems(items, "created_at", "asc").map((item) => item.id), ["2", "1"]);
});
