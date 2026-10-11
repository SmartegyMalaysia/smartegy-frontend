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

const {
  buildCalculatorHelpSections,
  calculateCommissionExample,
  createDefaultCalculatorDraft,
} = require(path.resolve(__dirname, "../lib/help-commission-calculator.ts"));
const { createHelpPdf } = require(path.resolve(__dirname, "../lib/help-pdf.ts"));

function person(id, level, referredById = null, name = id) { return { id, name, level, referredById }; }
function draft(people, sellerId, projectValue = "24500") { return { people, sellerId, projectValue }; }
function byId(result, id) { return result.people.find((entry) => entry.id === id); }

function pdfText(sections) {
  const article = { id: "calculator-example", title: "Commission Example", summary: "Educational preview", category: "Help", roles: ["agent"], sections };
  const pdf = Buffer.from(createHelpPdf("agent", [article])).toString("latin1");
  const text = Array.from(pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj ET/g), (match) => match[1]
    .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\")).join(" ").replace(/\s+/g, " ");
  return { pdf, text };
}

test("default branching example resolves each cut and keeps the other branch at zero", () => {
  const initial = createDefaultCalculatorDraft();
  assert.deepEqual(initial.people, [person("A", 3, null, "Person A"), person("B", 2, "A", "Person B"), person("C", 1, "B", "Person C"), person("D", 1, "B", "Person D")]);
  assert.equal(initial.sellerId, "C");
  assert.equal(initial.projectValue, "24500");

  const result = calculateCommissionExample(initial);
  assert.equal(result.ok, true);
  assert.equal(result.projectValueSen, 2450000);
  assert.deepEqual(result.chainIds, ["C", "B", "A"]);
  assert.deepEqual(byId(result, "C").cutsSen, [134750, 0, 0]);
  assert.deepEqual(byId(result, "B").cutsSen, [0, 73500, 0]);
  assert.deepEqual(byId(result, "A").cutsSen, [0, 0, 36750]);
  assert.deepEqual(byId(result, "D").cutsSen, [0, 0, 0]);
  assert.equal(byId(result, "D").reason, "Not on the seller's referral chain.");
  assert.equal(result.totalAgentSen, 245000);
  assert.deepEqual(result.unassignedCuts, []);
});

test("documented hierarchy scenarios assign cumulative cuts and nearest eligible uplines", () => {
  const normal = calculateCommissionExample(draft([person("S", 1, "L"), person("L", 1, "B"), person("B", 2, "G"), person("G", 3)], "S"));
  assert.equal(normal.ok, true);
  assert.deepEqual(byId(normal, "S").cutsSen, [134750, 0, 0]);
  assert.deepEqual(byId(normal, "B").cutsSen, [0, 73500, 0]);
  assert.deepEqual(byId(normal, "G").cutsSen, [0, 0, 36750]);

  const fallback = calculateCommissionExample(draft([person("S", 1, "G"), person("G", 3, "B"), person("B", 2)], "S"));
  assert.deepEqual(byId(fallback, "G").cutsSen, [0, 73500, 36750]);
  assert.deepEqual(byId(fallback, "B").cutsSen, [0, 0, 0]);

  const level2Seller = calculateCommissionExample(draft([person("S", 2, "L"), person("L", 1, "G"), person("G", 3)], "S"));
  assert.deepEqual(byId(level2Seller, "S").cutsSen, [134750, 73500, 0]);
  assert.deepEqual(byId(level2Seller, "G").cutsSen, [0, 0, 36750]);

  const level2WithoutLevel3 = calculateCommissionExample(draft([person("S", 2, "L"), person("L", 1)], "S"));
  assert.deepEqual(level2WithoutLevel3.unassignedCuts.map((cut) => cut.level), [3]);

  const level3Seller = calculateCommissionExample(draft([person("S", 3, "U"), person("U", 2, "V"), person("V", 3)], "S"));
  assert.deepEqual(byId(level3Seller, "S").cutsSen, [134750, 73500, 36750]);
  assert.deepEqual(byId(level3Seller, "U").cutsSen, [0, 0, 0]);
  assert.deepEqual(level3Seller.unassignedCuts, []);
});

test("duplicate ranks are skipped and mixed hierarchy follows the nearest Level 3 rule", () => {
  const repeated = calculateCommissionExample(draft([
    person("S", 1, "L2a"), person("L2a", 2, "L2b"), person("L2b", 2, "L3a"), person("L3a", 3, "L3b"), person("L3b", 3),
  ], "S"));
  assert.deepEqual(byId(repeated, "L2a").cutsSen, [0, 73500, 0]);
  assert.deepEqual(byId(repeated, "L2b").cutsSen, [0, 0, 0]);
  assert.deepEqual(byId(repeated, "L3a").cutsSen, [0, 0, 36750]);
  assert.deepEqual(byId(repeated, "L3b").cutsSen, [0, 0, 0]);

  const mixed = calculateCommissionExample(draft([person("S", 1, "Near3"), person("Near3", 3, "Far2"), person("Far2", 2)], "S"));
  assert.deepEqual(byId(mixed, "Near3").cutsSen, [0, 73500, 36750]);
  assert.deepEqual(byId(mixed, "Far2").cutsSen, [0, 0, 0]);
});

test("missing eligible cuts remain unassigned and are never silently reassigned", () => {
  const result = calculateCommissionExample(draft([person("S", 1), person("Branch", 3)], "S"));
  assert.equal(result.ok, true);
  assert.deepEqual(byId(result, "S").cutsSen, [134750, 0, 0]);
  assert.deepEqual(byId(result, "Branch").cutsSen, [0, 0, 0]);
  assert.deepEqual(result.unassignedCuts.map((cut) => [cut.level, cut.amountSen]), [[2, 73500], [3, 36750]]);
  assert.equal(result.totalAgentSen, 134750);
});

test("money uses integer sen, rounds half up, and rejects unsafe project amounts", () => {
  const oneTenth = calculateCommissionExample(draft([person("S", 3)], "S", "0.10"));
  assert.deepEqual(byId(oneTenth, "S").cutsSen, [1, 0, 0]);
  assert.equal(byId(oneTenth, "S").reason, "Seller receives Level 1 cut, Level 2 cut, and Level 3 cut.");
  assert.equal(oneTenth.totalAgentSen, 1);

  const belowHalfCent = calculateCommissionExample(draft([person("S", 3)], "S", "0.09"));
  assert.deepEqual(byId(belowHalfCent, "S").cutsSen, [0, 0, 0]);
  assert.equal(byId(belowHalfCent, "S").reason, "Seller receives Level 1 cut, Level 2 cut, and Level 3 cut.");

  const halfUp = calculateCommissionExample(draft([person("S", 3)], "S", "1.00"));
  assert.deepEqual(byId(halfUp, "S").cutsSen, [6, 3, 2]);

  const largestSafeSen = Math.floor((Number.MAX_SAFE_INTEGER - 5000) / 1000);
  const largestSafeValue = `${Math.floor(largestSafeSen / 100)}.${String(largestSafeSen % 100).padStart(2, "0")}`;
  const largestSafe = calculateCommissionExample(draft([person("S", 3)], "S", largestSafeValue));
  assert.equal(largestSafe.ok, true);
  assert.equal(largestSafe.projectValueSen, largestSafeSen);
  assert.ok(Number.isSafeInteger(largestSafe.totalAgentSen));

  const tooLarge = calculateCommissionExample(draft([person("S", 1)], "S", "999999999999999999999999"));
  assert.equal(tooLarge.ok, false);
  assert.ok(tooLarge.errors.includes("Project value is too large to calculate safely."));
});

test("invalid networks report each problem and never calculate partial results", () => {
  const valid = draft([person("S", 1), person("P", 2)], "S");
  const invalids = [
    { ...valid, projectValue: "0" },
    { ...valid, projectValue: "-1" },
    { ...valid, projectValue: "1.234" },
    { ...valid, projectValue: "1e4" },
    { ...valid, sellerId: "missing" },
    { ...valid, people: [person("S", 1), person("S", 2)] },
    { ...valid, people: [person("S", 1, "missing")] },
    { ...valid, people: [person("S", 1, "S")] },
    { ...valid, people: [person("S", 1, "P"), person("P", 2, "S")] },
    { ...valid, people: [person("S", 7)] },
    { ...valid, people: [person("S", 1, null, "   ")] },
  ];
  for (const candidate of invalids) {
    const result = calculateCommissionExample(candidate);
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
  }

  const malformedNameAndReferrer = draft([{ id: "S", name: 3, level: 1, referredById: "missing" }], "S");
  assert.doesNotThrow(() => calculateCommissionExample(malformedNameAndReferrer));
});

test("network depth has no arbitrary cap", () => {
  const people = [person("P0", 1)];
  for (let index = 1; index < 5000; index++) people.push(person(`P${index}`, 1, `P${index - 1}`));
  const result = calculateCommissionExample(draft(people, "P4999"));
  assert.equal(result.ok, true);
  assert.equal(result.chainIds.length, 5000);
  assert.equal(result.chainIds[0], "P4999");
  assert.equal(result.chainIds[4999], "P0");
});

test("PDF snapshot includes the current branching example, all people, cuts, and no Office row", () => {
  const current = createDefaultCalculatorDraft();
  current.people[2].name = "Casey with a deliberately long agent name that wraps in PDF";
  current.people[3].name = "Dara Branch";
  const sections = buildCalculatorHelpSections(current);
  const json = JSON.stringify(sections);
  assert.match(json, /Casey with a deliberately long agent name/);
  assert.match(json, /Dara Branch/);
  assert.match(json, /RM1,347\.50/);
  assert.match(json, /RM735\.00/);
  assert.match(json, /RM367\.50/);
  assert.match(json, /Not on the seller's referral chain/);
  assert.doesNotMatch(json, /office|recipient/i);

  const { pdf, text } = pdfText(sections);
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(text, /Casey with a deliberately long agent name/);
  assert.match(text, /Dara Branch/);
  assert.match(text, /Level 1 cut/);
  assert.match(text, /Level 2 cut/);
  assert.match(text, /Level 3 cut/);
  assert.match(text, /RM1,347\.50/);
  assert.match(text, /No cuts are unassigned/);
  assert.doesNotMatch(text, /office|recipient/i);
});

test("unassigned example PDF shows each amount and says it is not reassigned", () => {
  const sections = buildCalculatorHelpSections(draft([person("Seller", 1)], "Seller"));
  const { text } = pdfText(sections);
  assert.match(text, /No eligible person in this example/);
  assert.match(text, /not added to another person's amount/);
  assert.match(text, /RM735\.00/);
  assert.match(text, /RM367\.50/);
  assert.doesNotMatch(text, /office|recipient/i);
});

test("invalid PDF snapshot explains errors and shows the current draft without stale totals", () => {
  const invalid = draft([person("S", 1, "missing", "Current Seller")], "S", "0");
  const sections = buildCalculatorHelpSections(invalid);
  const { text } = pdfText(sections);
  assert.match(text, /This example is incomplete/);
  assert.match(text, /positive project value/);
  assert.match(text, /not in the network/);
  assert.match(text, /Current Draft Inputs/);
  assert.match(text, /Current Seller/);
  assert.match(text, /Project value/);
  assert.doesNotMatch(text, /RM1,347\.50|First payment|Paid later/);
});
