const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "app/users/page.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

test("Users search delays repository requests while keeping the input responsive", () => {
  assert.ok(page.includes('useDebouncedValue(search)'));
  assert.ok(page.includes("search: debouncedSearch"));
});

test("Users sorting exposes field and direction controls and sortable table headers", () => {
  assert.ok(page.includes("<span>Sort order</span>"));
  assert.ok(page.includes('setSortDirection(value as "asc" | "desc")'));
  assert.ok(page.includes('sortableHeader("display_name", "User")'));
  assert.ok(page.includes('sortableHeader("created_at", "Created")'));
  assert.ok(page.includes("ariaSort:"));
});

test("Users preserves the table presentation with horizontal scrolling on mobile", () => {
  assert.ok(page.includes('className="desktop-user-table"'));
  assert.ok(!page.includes('className="mobile-user-list"'));
  assert.ok(!page.includes("function UserCard"));
  assert.ok(css.includes(".desktop-case-table, .desktop-commission-table, .desktop-user-table { display: block; min-width: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }"));
  assert.ok(!css.includes(".desktop-user-table { display: none; }"));
});
