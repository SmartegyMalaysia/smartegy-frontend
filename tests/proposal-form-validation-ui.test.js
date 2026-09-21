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
  assert.match(proposalSource, /MAX_TNB_RATE = 999999\.999999/);
  assert.match(proposalSource, /exceeds the supported TNB rate/);
  assert.match(proposalSource, /isCompletedHistoricalMonth/);
  assert.match(proposalSource, /seenMonths/);
  assert.match(proposalSource, /type ReadingErrors/);
  assert.match(proposalSource, /FieldError/);
  assert.match(proposalSource, /aria-describedby/);
  assert.match(proposalSource, /aria-invalid/);
  assert.doesNotMatch(proposalSource, /minimumProposalSaleAmountSen/);
  assert.doesNotMatch(proposalSource, /maxLength=\{2000\}/);
});

test("proposal validation does not reintroduce the removed commission floor", () => {
  assert.doesNotMatch(proposalSource, /minimum commission|commission floor|minimum sale/i);
  assert.ok(!proposalSource.includes("minimumProposalSaleAmountSen"));
});
