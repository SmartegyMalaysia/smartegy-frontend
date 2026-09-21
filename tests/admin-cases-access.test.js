const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const casesPageSource = fs.readFileSync(path.resolve(__dirname, "../app/cases/page.tsx"), "utf8");
const detailPageSource = fs.readFileSync(path.resolve(__dirname, "../app/cases/[caseId]/page.tsx"), "utf8");
const navigationSource = fs.readFileSync(path.resolve(__dirname, "../lib/navigation.ts"), "utf8");
const queueSource = fs.readFileSync(path.resolve(__dirname, "../components/case-queue.tsx"), "utf8");
const dashboardSource = fs.readFileSync(path.resolve(__dirname, "../app/dashboard/page.tsx"), "utf8");

test("Cases list stays staff-only while administrators are redirected", () => {
  assert.match(navigationSource, /label: "Cases"[\s\S]*roles: \["staff"\]/);
  assert.match(casesPageSource, /role === "admin"/);
  assert.match(casesPageSource, /router\.replace\("\/dashboard"\)/);
  assert.match(casesPageSource, /role === "agent" \? <PermissionDenied \/>/);
  assert.match(casesPageSource, /<CaseQueue actor=\{user\} isAgent=\{false\}/);
});

test("individual case access keeps role-specific back destinations and dashboard rows link to details", () => {
  assert.match(detailPageSource, /user\.role === "staff" \? "\/cases" : "\/dashboard"/);
  assert.match(queueSource, /href=\{`\/cases\/\$\{item\.id\}`\}/);
  assert.match(dashboardSource, /<CaseQueue actor=\{actor\} isAgent=\{isAgent\}/);
});
