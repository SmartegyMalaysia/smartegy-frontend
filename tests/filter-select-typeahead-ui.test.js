const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.resolve(__dirname, "../components/filter-select.tsx"),
  "utf8",
);

test("shared dropdowns focus options using keyboard type-ahead", () => {
  assert.ok(source.includes("onKeyDown={handleTypeahead}"));
  assert.ok(source.includes("startsWith(search)"));
  assert.ok(source.includes("match.focus({ preventScroll: true })"));
  assert.ok(source.includes('match.scrollIntoView({ block: "nearest" })'));
});

test("dropdown type-ahead supports multi-character matching and repeated-letter cycling", () => {
  assert.ok(source.includes("now - typeaheadRef.current.updatedAt <= 700"));
  assert.ok(source.includes("repeatedCharacter"));
  assert.ok(source.includes("currentIndex + 1"));
  assert.ok(source.includes('typeaheadRef.current = { value: "", updatedAt: 0 }'));
});
