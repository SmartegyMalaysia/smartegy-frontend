const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const css = read("app/globals.css");
const dataTable = read("components/data-table.tsx");
const caseQueue = read("components/case-queue.tsx");
const commissions = read("app/commissions/page.tsx");
const users = read("app/users/page.tsx");
const agents = read("app/agents/page.tsx");

test("shared data tables retain table markup inside a horizontal scroll container", () => {
  assert.ok(dataTable.includes('className="table-wrap"'));
  assert.ok(dataTable.includes("<table>"));
  assert.ok(css.includes(".table-wrap { overflow-x: auto; }"));
});

test("mobile views do not replace case, commission, or user tables with cards", () => {
  for (const [name, source, cardMarker] of [
    ["cases", caseQueue, "mobile-case-list"],
    ["commissions", commissions, "mobile-commission-list"],
    ["users", users, "mobile-user-list"],
  ]) {
    assert.ok(source.includes("<DataTable"), `${name} should render the shared table.`);
    assert.ok(!source.includes(cardMarker), `${name} should not render a mobile card substitute.`);
  }
  assert.ok(!css.includes(".desktop-case-table:not(.agent-table) { display: none; }"));
  assert.ok(!css.includes(".desktop-commission-table { display: none; }"));
  assert.ok(!css.includes(".desktop-user-table { display: none; }"));
});

test("all responsive table wrappers remain visible and horizontally scrollable", () => {
  assert.ok(css.includes(".desktop-case-table, .desktop-commission-table, .desktop-user-table { display: block; min-width: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }"));
  assert.ok(css.includes(".case-savings-detail-table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }"));
});

test("the agents table keeps all annual reporting columns aligned inside one scroll container", () => {
  assert.ok(agents.includes('headers={["Agent", "Level", "Upline", "Successful Cases", "Direct Agents", "Lifetime Personal Sales", "Lifetime Referral Sales", "Lifetime Commission Earned", "Annual Commission Earned", "Annual Commission Paid", "Eligibility"]}'));
  assert.equal((agents.match(/<th/g) ?? []).length, 0, "agent headers should be owned by DataTable");
  assert.ok(agents.includes('"Annual Commission Earned", "Annual Commission Paid", "Eligibility"'));
  assert.ok(css.includes(".agent-table { min-width: 0; overflow: hidden; }"));
  assert.ok(css.includes(".agent-table .table-wrap { overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }"));
  assert.ok(css.includes(".agent-table th:nth-child(11) { width: 8%; }"));
});
