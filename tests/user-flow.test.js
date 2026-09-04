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
  const updated = await repository.userRepository.update(admin, "user-005", { displayName: "Nadia Yusuf", phone: "+60 12-111 2222", role: "agent", accountStatus: "active" });
  assert.equal(updated.ok, true);
  assert.equal(updated.data.accountStatus, "active");
  assert.equal(updated.data.phone, "+60 12-111 2222");
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
