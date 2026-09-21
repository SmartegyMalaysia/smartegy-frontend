const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const reviewSource = fs.readFileSync(path.resolve(__dirname, "../components/registration-review.tsx"), "utf8");
const uiSource = fs.readFileSync(path.resolve(__dirname, "../components/ui.tsx"), "utf8");
const repositorySource = fs.readFileSync(path.resolve(__dirname, "../lib/supabase-registration-repository.ts"), "utf8");

test("shared Button exposes explicit loading behavior", () => {
  assert.match(uiSource, /loading = false/);
  assert.match(uiSource, /disabled=\{disabled \|\| loading\}/);
  assert.match(uiSource, /button-spinner/);
});

test("staff payment verification fields are required and validated before opening confirmation", () => {
  assert.match(reviewSource, /Verified amount \(RM\).*required-mark/);
  assert.match(reviewSource, /<label><span>Verified amount \(RM\) <span className="required-mark">\*<\/span><\/span><TextInput/);
  assert.match(reviewSource, /Verified payment date.*required-mark/);
  assert.match(reviewSource, /Verified amount is required/);
  assert.ok(reviewSource.includes('const amountMatch = /^(\\d+)(?:\\.(\\d{1,2}))?$/.exec(normalizedAmount);'));
  assert.match(reviewSource, /parsedAmountSen !== registration\.feeAmountSen/);
  assert.match(reviewSource, /verifiedAmountSen: parsedAmountSen/);
  assert.doesNotMatch(reviewSource, /Math\.round\(parsedAmount \* 100\) !== registration\.feeAmountSen/);
  assert.match(reviewSource, /Verified payment date is required/);
  assert.match(reviewSource, /maxLength=\{REGISTRATION_PAYMENT_REJECTION_REASON_MAX_LENGTH\}/);
  assert.match(reviewSource, /paymentReason\.trim\(\)/);
  assert.match(reviewSource, /payment-rejection-reason-count/);
  assert.match(reviewSource, /onClick=\{verify\}/);
  assert.match(reviewSource, /loading=\{actionLoading\}/);
});

test("registration actions preserve uploaded payment proof after mutations", () => {
  assert.match(repositorySource, /async function hydrateRegistration[\s\S]*fetchRegistration\(row\.id\)/);
  assert.match(repositorySource, /verify_registration_fee[\s\S]*hydrateRegistration\(data\)/);
  assert.match(repositorySource, /approve_registration[\s\S]*hydrateRegistration\(data\)/);
});
