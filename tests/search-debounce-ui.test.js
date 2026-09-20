const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const searchSurfaces = [
  "components/case-queue.tsx",
  "components/registration-queue.tsx",
  "app/agents/page.tsx",
  "app/approvals/page.tsx",
  "app/commissions/page.tsx",
  "app/payouts/page.tsx",
  "app/users/page.tsx",
];

test("every page with a search input uses the shared debounce behavior", () => {
  for (const file of searchSurfaces) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.ok(source.includes('type="search"'), `${file} should contain a search input.`);
    assert.ok(source.includes("useDebouncedValue"), `${file} should debounce search requests.`);
  }
});

test("the shared search delay is 300 milliseconds and clears immediately", () => {
  const source = fs.readFileSync(path.join(root, "lib/use-debounced-value.ts"), "utf8");
  assert.ok(source.includes("SEARCH_DEBOUNCE_MS = 300"));
  assert.ok(source.includes('if (value === "")'));
  assert.ok(source.includes("window.clearTimeout(timeout)"));
});
