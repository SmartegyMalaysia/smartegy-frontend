const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const notFoundSource = fs.readFileSync(path.resolve(__dirname, "../app/not-found.tsx"), "utf8");

test("unknown routes use the branded application not-found state", () => {
  assert.match(notFoundSource, /<EmptyState/);
  assert.match(notFoundSource, /title="Page not found"/);
  assert.match(notFoundSource, /href="\/dashboard"/);
  assert.doesNotMatch(notFoundSource, /This page could not be found/);
});
