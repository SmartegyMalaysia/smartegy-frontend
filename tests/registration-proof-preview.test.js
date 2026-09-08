const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const configSource = fs.readFileSync(path.resolve(__dirname, "../next.config.mjs"), "utf8");
const reviewSource = fs.readFileSync(path.resolve(__dirname, "../components/registration-review.tsx"), "utf8");

test("registration payment proof images can load inside the preview popup", () => {
  assert.match(
    configSource,
    /img-src[^\n]*https:\/\/\*\.supabase\.co[^\n]*http:\/\/127\.0\.0\.1:\*[^\n]*http:\/\/localhost:\*/,
    "The image CSP must allow hosted and local Supabase Storage signed URLs.",
  );
  assert.ok(reviewSource.includes("<PopupModal open={Boolean(proofAccess)}"), "Payment proofs must open in a popup modal.");
  assert.ok(reviewSource.includes('<img className="registration-proof-image"'), "Image payment proofs must render inside the popup.");
});
