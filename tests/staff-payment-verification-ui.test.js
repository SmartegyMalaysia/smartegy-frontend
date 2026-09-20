const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const reviewSource = fs.readFileSync(path.resolve(__dirname, "../components/registration-review.tsx"), "utf8");
const uiSource = fs.readFileSync(path.resolve(__dirname, "../components/ui.tsx"), "utf8");

test("shared Button exposes explicit loading behavior", () => {
  assert.match(uiSource, /loading = false/);
  assert.match(uiSource, /disabled=\{disabled \|\| loading\}/);
  assert.match(uiSource, /button-spinner/);
});

test("staff payment verification fields are required and validated before opening confirmation", () => {
  assert.match(reviewSource, /Verified amount \(RM\).*required-mark/);
  assert.match(reviewSource, /Verified payment date.*required-mark/);
  assert.match(reviewSource, /Verified amount is required/);
  assert.match(reviewSource, /Verified payment date is required/);
  assert.match(reviewSource, /onClick=\{verify\}/);
  assert.match(reviewSource, /loading=\{actionLoading\}/);
});
