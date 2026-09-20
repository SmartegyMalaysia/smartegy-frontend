const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const profilePage = fs.readFileSync(
  path.resolve(__dirname, "../app/settings/profile/page.tsx"),
  "utf8",
);

test("profile bank dropdown offers Other and reveals a reusable bank-name field", () => {
  assert.ok(profilePage.includes('const OTHER_BANK_OPTION = "Other"'));
  assert.ok(profilePage.includes("options={BANK_OPTIONS}"));
  assert.ok(profilePage.includes("bankSelection === OTHER_BANK_OPTION && <ProfileField"));
  assert.ok(profilePage.includes('id="profile-other-bank-name"'));
  assert.ok(profilePage.includes("onChange={updateOtherBankName}"));
});

test("custom bank names are submitted through the existing bankName contract", () => {
  assert.ok(profilePage.includes('updateBank("bankName", value)'));
  assert.ok(profilePage.includes("bankSelectionFor(profile.bankDetails?.bankName"));
  assert.ok(profilePage.includes("nextBankSelection === OTHER_BANK_OPTION ? next.bankName"));
});
