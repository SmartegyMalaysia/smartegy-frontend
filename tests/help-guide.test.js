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

const { getHelpArticles, searchHelpArticles, HELP_REVISION } = require(path.resolve(__dirname, "../lib/help-guide.ts"));

test("staff gets the exact shared admin guide core, with admin topics restricted", () => {
  const staff = getHelpArticles("staff");
  const admin = getHelpArticles("admin");
  assert.deepEqual(staff, admin.filter((article) => !article.id.startsWith("admin-")));
  assert.ok(admin.some((article) => article.id === "admin-approvals"));
  assert.ok(admin.some((article) => article.id === "admin-users"));
  assert.ok(!staff.some((article) => article.id.startsWith("admin-")));
  assert.equal(staff.find((article) => article.id === "commission-explainer").relatedHref, "/payouts");
  assert.equal(admin.find((article) => article.id === "commission-explainer").relatedHref, "/payouts");
  assert.deepEqual(getHelpArticles("bogus"), []);
});

test("every role can find the core topics and gets only its own tasks", () => {
  for (const role of ["agent", "staff", "admin"]) {
    const articles = getHelpArticles(role);
    for (const id of ["getting-started", "referral-mechanics", "commission-explainer", "case-documents-payments", "account-support"]) {
      assert.ok(articles.some((article) => article.id === id), `${role} should have ${id}`);
    }
    assert.ok(articles.some((article) => article.id === "operations-workflows") === (role !== "agent"));
  }
  assert.deepEqual(getHelpArticles("agent").filter((article) => article.id.startsWith("admin-")), []);
  assert.equal(HELP_REVISION, "29 September 2026");
});

test("guide uses short task content and includes the shared commission and referral visuals", () => {
  for (const role of ["agent", "staff", "admin"]) {
    const articles = getHelpArticles(role);
    const commission = articles.find((article) => article.id === "commission-explainer");
    const worked = commission.sections.find((section) => section.id === "worked-example");
    assert.match(worked.title, /commission example/i);
    assert.match(worked.paragraphs.join(" "), /who referred each person/);
    assert.equal(worked.details, undefined);
    const calculation = commission.sections.find((section) => section.id === "commission-calculation");
    assert.equal(calculation.details, true);
    assert.equal(calculation.table.headers[0], "Cut");
    assert.deepEqual(calculation.table.rows.map((row) => row[0]), ["Level 1", "Level 2", "Level 3"]);
    assert.doesNotMatch(JSON.stringify(calculation).toLowerCase(), /recipient|office/);
    assert.ok(calculation.table.rows.some((row) => row[0] === "Level 2"));
    assert.ok(commission.sections.find((section) => section.id === "commission-flow").flow.length >= 3);
    const referral = articles.find((article) => article.id === "referral-mechanics");
    assert.ok(referral.sections.some((section) => section.flow?.length));
    const sharedText = JSON.stringify([commission, referral]).toLowerCase();
    assert.match(sharedText, /stage 5/);
    assert.match(sharedText, /does not promise payment/);
    assert.doesNotMatch(sharedText, /17-month/);
  }
  assert.equal(getHelpArticles("agent").find((article) => article.id === "commission-explainer").relatedHref, "/commissions");
  assert.ok(getHelpArticles("agent").find((article) => article.id === "agent-bank-details").sections[0].steps[2].includes("Save bank details"));
  assert.ok(getHelpArticles("staff").find((article) => article.id === "getting-started").sections.every((section) => section.details));
});

test("agent case actions and profile referral instructions match available tasks", () => {
  const agent = getHelpArticles("agent");
  const cases = agent.find((article) => article.id === "agent-cases");
  const caseText = JSON.stringify(cases);
  for (const action of ["Accept Proposal", "Record Downpayment", "Confirm Installation Date", "Record Post-Installation Payment", "Record Savings", "Record Installment Payment"]) assert.ok(caseText.includes(action));
  assert.match(caseText, /exactly three unique completed months/);
  const sharing = agent.find((article) => article.id === "agent-referral-sharing");
  assert.match(JSON.stringify(sharing), /Your Profile/);
  assert.match(JSON.stringify(sharing), /does not promise a cash reward just for signing up/);
  assert.equal(cases.sections.find((section) => section.id === "case-actions").details, true);
  assert.deepEqual(cases.sections.find((section) => section.id === "submit").image, {
    src: "/help/submit-case.jpg", alt: "Dashboard with the Submit New Case button marked 1.",
    caption: "Example screen. Marker 1 shows Submit New Case.", width: 612, height: 111,
  });
  assert.equal(sharing.sections[0].image.width, 860);
  assert.equal(sharing.sections[0].image.height, 206);
  assert.match(JSON.stringify(sharing.sections[0]), /Marker 1 copies the sign-up link\. Marker 2 copies the referral code\./);
  const bank = agent.find((article) => article.id === "agent-bank-details").sections[0];
  assert.equal(bank.image.src, "/help/bank-details.jpg");
  assert.equal(bank.image.width, 292);
  assert.equal(bank.image.height, 518);
  assert.match(bank.image.caption, /Marker 1 saves your bank details/);
});

test("search includes visual labels and never searches hidden role articles", () => {
  const agent = getHelpArticles("agent");
  assert.deepEqual(searchHelpArticles(agent, "project value first payment").map((article) => article.id), ["commission-explainer"]);
  assert.deepEqual(searchHelpArticles(agent, "manage users").map((article) => article.id), []);
  assert.deepEqual(searchHelpArticles(agent, "   "), agent);
});
