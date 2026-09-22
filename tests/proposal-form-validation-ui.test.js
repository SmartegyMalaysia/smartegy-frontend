const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const proposalSource = fs.readFileSync(path.resolve(__dirname, "../components/proposal-form.tsx"), "utf8");

test("prepare proposal validation covers editable fields and reading rows", () => {
  assert.match(proposalSource, /function getProposalErrors/);
  assert.match(proposalSource, /decimalFieldError/);
  assert.match(proposalSource, /MAX_MONEY_DECIMAL_PLACES = 2/);
  assert.match(proposalSource, /MAX_KWH_DECIMAL_PLACES = 3/);
  assert.doesNotMatch(proposalSource, /MAX_TNB_RATE|exceeds the supported TNB rate/);
  assert.doesNotMatch(proposalSource, /Sales representative is required/);
  assert.match(proposalSource, /isCompletedHistoricalMonth/);
  assert.match(proposalSource, /seenMonths/);
  assert.match(proposalSource, /type ReadingErrors/);
  assert.match(proposalSource, /FieldError/);
  assert.match(proposalSource, /aria-describedby/);
  assert.match(proposalSource, /aria-invalid/);
  assert.match(proposalSource, /const isReadingWarning = Boolean\(warning\?\.startsWith\("Reading "\)\)/);
  assert.match(proposalSource, /const isDownpaymentWarning = Boolean\(warning\?\.toLowerCase\(\)\.includes\("downpayment"\)\)/);
  assert.doesNotMatch(proposalSource, /isProposalDetailsWarning/);
  assert.match(proposalSource, /TNB Readings[\s\S]*showWarnings && warning && isReadingWarning && <div className="proposal-warning"[^>]*role="alert"[^>]*>⚠ \{warning\}<\/div>/);
  assert.match(proposalSource, /Calculated Preview[\s\S]*showWarnings && warning && isDownpaymentWarning && <div className="proposal-warning"[^>]*role="alert"[^>]*>⚠ \{warning\}<\/div>/);
  assert.doesNotMatch(proposalSource, /proposal-downpayment-error/);
  assert.match(proposalSource, /proposal-preview-downpayment-error/);
  assert.doesNotMatch(proposalSource, /\{warning && <p className="proposal-warning"/);
  assert.match(proposalSource, /const readingHasInput = Boolean\(reading\.month \|\| reading\.year \|\| reading\.bill \|\| reading\.kwh\)/);
  assert.doesNotMatch(proposalSource, /<FieldError id=\{`proposal-reading-\$\{index \+ 1\}-(?:bill|kwh)-error`\}/);
  assert.doesNotMatch(proposalSource, /minimumProposalSaleAmountSen/);
  assert.doesNotMatch(proposalSource, /maxLength=\{2000\}/);
});

test("proposal validation does not reintroduce the removed commission floor", () => {
  assert.doesNotMatch(proposalSource, /minimum commission|commission floor|minimum sale/i);
  assert.ok(!proposalSource.includes("minimumProposalSaleAmountSen"));
});
