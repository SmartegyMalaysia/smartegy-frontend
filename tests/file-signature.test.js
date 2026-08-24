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

const { validateFileSignature } = require(path.resolve(__dirname, "../lib/document-config.ts"));

function file(bytes, type) {
  const blob = new Blob([Uint8Array.from(bytes)], { type });
  return Object.assign(blob, { name: "upload" });
}

test("accepted upload types must match their magic bytes", async () => {
  assert.equal(await validateFileSignature(file([0x25, 0x50, 0x44, 0x46, 0x2d], "application/pdf")), null);
  assert.equal(await validateFileSignature(file([0xff, 0xd8, 0xff, 0xe0], "image/jpeg")), null);
  assert.match(await validateFileSignature(file([0x4d, 0x5a, 0x90], "application/pdf")), /do not match/);
});
