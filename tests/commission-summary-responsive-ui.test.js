const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

test("commission summary text stays within its card in landscape layouts", () => {
  assert.ok(css.includes(".commission-summary-card { display: grid; grid-template-columns: minmax(0, 1fr); width: 100%; min-width: 0;"));
  assert.ok(css.includes(".commission-summary-card > * { max-width: 100%; min-width: 0; }"));
  assert.ok(css.includes("white-space: normal; overflow-wrap: anywhere; word-break: break-word;"));
  assert.ok(css.includes("@media (max-width: 1120px) { .commission-overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }"));
});
