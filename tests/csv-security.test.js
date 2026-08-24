const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  module._compile(output, filename);
};

const { csvCell, serializeCsv } = require(path.resolve(__dirname, "../lib/csv.ts"));

test("spreadsheet formulas are neutralized even after leading whitespace", () => {
  for (const value of ["=2+2", "+cmd", "-10+20", "@SUM(A1:A2)", "  =HYPERLINK(\"https://example.test\")", "\t@cmd"]) {
    assert.ok(csvCell(value).startsWith("\"'"), value);
  }
});

test("ordinary CSV escaping is preserved", () => {
  assert.equal(csvCell('A "quoted", value'), '"A ""quoted"", value"');
  assert.equal(serializeCsv([["Name", "Value"], ["Safe", "line\nbreak"]]), '"Name","Value"\r\n"Safe","line\nbreak"\r\n');
});
