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

const { getHelpArticles } = require(path.resolve(__dirname, "../lib/help-guide.ts"));
const { createHelpPdf, loadHelpPdfImages } = require(path.resolve(__dirname, "../lib/help-pdf.ts"));

function localImages(articles) {
  const images = {};
  for (const article of articles) for (const section of article.sections) if (section.image) {
    const imagePath = path.resolve(__dirname, `../public${section.image.src}`);
    if (fs.existsSync(imagePath)) images[section.image.src] = { bytes: new Uint8Array(fs.readFileSync(imagePath)), width: section.image.width, height: section.image.height };
  }
  return images;
}

function render(role, articles = getHelpArticles(role), images = {}) {
  return Buffer.from(createHelpPdf(role, articles, { ...localImages(articles), ...images })).toString("latin1");
}

function extractText(pdf) {
  return Array.from(pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj ET/g), (match) => match[1]
    .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\"))
    .join(" ").replace(/\s+/g, " ");
}

function guideWords(article) {
  const values = [article.title, article.summary, article.category, article.taskLabel ?? "", ...article.sections.flatMap((section) => [
    section.title, ...(section.paragraphs ?? []), ...(section.steps ?? []), ...(section.bullets ?? []), section.note ?? "",
    ...(section.table?.headers ?? []), ...(section.table?.rows.flat() ?? []),
    ...(section.flow?.flatMap((item) => [item.label, item.description ?? ""]) ?? []),
    ...(section.moneyCards?.flatMap((card) => [card.label, card.amount, card.note ?? ""]) ?? []),
    ...(section.image ? [section.image.alt, section.image.caption] : []),
  ])];
  return values.join(" ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...").replace(/\u00a0/g, " ").replace(/\u00b7/g, " - ").replace(/\u00d7/g, " x ").replace(/[^\x20-\x7e]/g, "?")
    .toLowerCase().match(/[a-z0-9]+(?:[-'][a-z0-9]+)*%?/g) ?? [];
}

function assertGuideIncluded(pdf, articles) {
  const extracted = extractText(pdf).toLowerCase();
  for (const article of articles) for (const word of guideWords(article)) {
    if (word.length > 1) assert.ok(extracted.includes(word), `PDF omitted '${word}' from ${article.id}`);
  }
}

function assertValidXref(pdf) {
  const xrefOffset = Number(pdf.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);
  assert.ok(Number.isInteger(xrefOffset));
  assert.ok(pdf.slice(xrefOffset).startsWith("xref\n"));
  const xref = pdf.slice(xrefOffset).split("\n");
  const objectCount = Number(xref[1].split(" ")[1]);
  for (let index = 1; index < objectCount; index++) {
    const offset = Number(xref[index + 2].slice(0, 10));
    assert.ok(pdf.slice(offset).startsWith(`${index} 0 obj\n`), `bad xref offset for object ${index}`);
  }
  for (const match of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = match.index + match[0].length;
    assert.equal(pdf.slice(start + Number(match[1]), start + Number(match[1]) + 10), "\nendstream");
  }
}

function approximateHelveticaWidth(text, size, bold) {
  let width = 0;
  for (const character of text) {
    if (" ilI!.,:;'|".includes(character)) width += 0.24;
    else if ("MW@%&".includes(character)) width += 0.82;
    else if (character === " ") width += 0.28;
    else if (/[A-Z]/.test(character)) width += 0.62;
    else if (/[0-9]/.test(character)) width += 0.56;
    else width += 0.51;
  }
  return width * size * (bold ? 1.015 : 1.01);
}

function assertTextWithinRightMargin(pdf) {
  const commands = /BT \/(F[12]) ([\d.]+) Tf ([\d.]+) ([\d.-]+) Td \(((?:\\.|[^\\)])*)\) Tj ET/g;
  for (const match of pdf.matchAll(commands)) {
    const [, font, sizeText, xText, , escaped] = match;
    const line = escaped.replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
    if (/^\d+(?: \/ \d+)?$/.test(line)) continue;
    const right = Number(xText) + approximateHelveticaWidth(line, Number(sizeText), font === "F2");
    assert.ok(right <= 560, `text extends beyond right margin (${right.toFixed(2)}pt): ${line}`);
  }
}

function assertImageCaptionsBelowImages(pdf) {
  let checked = 0;
  const streams = /<< \/Length \d+ >>\nstream\n([\s\S]*?)\nendstream/g;
  const imageDraw = /([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\n\/(Im\d+) Do/g;
  const captionText = /BT \/F1 8\.5 Tf [\d.-]+ ([\d.-]+) Td \(((?:\\.|[^\\)])*)\) Tj ET/g;
  for (const streamMatch of pdf.matchAll(streams)) {
    const stream = streamMatch[1];
    const images = Array.from(stream.matchAll(imageDraw));
    images.forEach((image, index) => {
      const imageY = Number(image[4]);
      const start = image.index + image[0].length;
      const end = images[index + 1]?.index ?? stream.length;
      const following = stream.slice(start, end);
      const captionLines = Array.from(following.matchAll(captionText));
      assert.ok(captionLines.length > 0, `${image[5]} should have a caption below it`);
      const highestBaseline = Math.max(...captionLines.map((match) => Number(match[1])));
      assert.ok(highestBaseline + 16 <= imageY, `${image[5]} caption does not have enough space below its image`);
      checked++;
    });
  }
  assert.ok(checked > 0, "PDF should contain image placement operations");
}

test("PDF is paginated, searchable, and has working article and section destinations", () => {
  for (const role of ["agent", "staff", "admin"]) {
    const articles = getHelpArticles(role);
    const pdf = render(role);
    assert.ok(pdf.startsWith("%PDF-1.4"));
    assert.match(pdf, /Help & User Guide/);
    assert.match(pdf, /29 September 2026/);
    assert.match(pdf, /\/Encoding \/WinAnsiEncoding/);
    const pages = Number(pdf.match(/\/Type \/Pages \/Kids \[[^\]]+\] \/Count (\d+)/)?.[1]);
    assert.ok(pages >= 5, `${role} guide should span cover, contents, and topics`);
    const expectedLinks = articles.reduce((sum, article) => sum + 1 + article.sections.length, 0);
    assert.equal((pdf.match(/\/Subtype \/Link/g) ?? []).length, expectedLinks);
    assert.equal((pdf.match(/\/Dest \[\d+ 0 R \/XYZ null [\d.]+ null\]/g) ?? []).length, expectedLinks);
    assertGuideIncluded(pdf, articles);
    assertTextWithinRightMargin(pdf);
    assertValidXref(pdf);
  }
});

test("shared money cards, process steps, and role content appear in the right PDFs", () => {
  const agent = render("agent");
  const staff = render("staff");
  const admin = render("admin");
  assert.equal((agent.match(/\/Subtype \/Image/g) ?? []).length, 3);
  assert.equal((staff.match(/\/Subtype \/Image/g) ?? []).length, 0);
  assert.match(agent, /219\.85 0 0 390\.00/);
  assertImageCaptionsBelowImages(agent);
  for (const pdf of [agent, staff, admin]) {
    const text = extractText(pdf);
    assert.match(text, /Stage 5/);
    assert.match(text, /5\.5%/);
    assert.match(text, /3\.0%/);
    assert.match(text, /1\.5%/);
    assert.match(text, /Ready for payment/);
    assert.match(text, /Share link or code/);
  }
  const agentText = extractText(agent);
  assert.match(agentText, /Accept Proposal/);
  assert.match(agentText, /Record Savings/);
  assert.match(agentText, /Add Payout Bank Details/);
  assert.match(agentText, /Marker 1 copies the sign-up link\. Marker 2 copies the referral code\./);
  assert.match(agentText, /Marker 1 saves your bank details\./);
  assert.match(agentText, /Marker 1 shows Submit New Case\./);
  const staffText = extractText(staff);
  assert.match(staffText, /Mark a Payout Settled/);
  assert.doesNotMatch(staffText, /Approve level changes/);
  assert.doesNotMatch(staffText, /Manage Users/i);
  assert.match(extractText(admin), /Approve Level Changes/);
  assert.match(extractText(admin), /Manage Users/);
});

function fixtureJpeg(width, height) {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);
}

test("PDF embeds JPEGs and draws labeled flow and money cards", () => {
  const articles = getHelpArticles("agent");
  const source = "/help-test.jpg";
  const visualArticle = {
    id: "visual-test", title: "Visual Test", summary: "A visual article.", category: "Test", roles: ["agent"],
    sections: [{ id: "visual", title: "Visual steps", image: { src: source, alt: "Case screen", caption: "Open a case", width: 20, height: 10 }, flow: [{ label: "Open", description: "Start here" }], moneyCards: [{ label: "Total", amount: "RM1.00", note: "Example" }] }],
  };
  const imageBytes = fixtureJpeg(20, 10);
  const pdf = render("agent", [...articles, visualArticle], { [source]: { bytes: imageBytes, width: 20, height: 10 } });
  assert.match(pdf, /\/Subtype \/Image/);
  assert.match(pdf, /\/ASCIIHexDecode \/DCTDecode/);
  assert.match(extractText(pdf), /Open a case/);
  assert.match(extractText(pdf), /RM1\.00/);
  assert.throws(() => createHelpPdf("agent", [...articles, visualArticle]), /Missing help image/);
  assertValidXref(pdf);
});

test("image loader validates same-origin JPEGs and fails clearly on unavailable images", async () => {
  const articles = [{ id: "x", title: "x", summary: "x", category: "x", roles: ["agent"], sections: [{ id: "s", title: "s", image: { src: "/guide.jpg", alt: "x", caption: "x", width: 20, height: 10 } }] }];
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, headers: { get: () => "image/jpeg" }, arrayBuffer: async () => fixtureJpeg(20, 10).buffer });
    const loaded = await loadHelpPdfImages(articles);
    assert.equal(loaded["/guide.jpg"].width, 20);
    global.fetch = async () => ({ ok: false, status: 404, headers: { get: () => "image/jpeg" } });
    await assert.rejects(loadHelpPdfImages(articles), /Could not load help image/);
    global.fetch = async () => ({ ok: true, headers: { get: () => "image/png" }, arrayBuffer: async () => new ArrayBuffer(0) });
    await assert.rejects(loadHelpPdfImages(articles), /not a JPEG/);
  } finally { global.fetch = originalFetch; }
});

test("every screenshot referenced by the agent guide loads from its real public JPEG", async () => {
  const articles = getHelpArticles("agent");
  const refs = articles.flatMap((article) => article.sections.flatMap((section) => section.image ? [section.image] : []));
  const originalFetch = global.fetch;
  const requested = [];
  try {
    global.fetch = async (src, options) => {
      requested.push([src, options.credentials]);
      const file = path.resolve(__dirname, `../public${src}`);
      const bytes = fs.readFileSync(file);
      const copy = new Uint8Array(bytes);
      return { ok: true, headers: { get: () => "image/jpeg" }, arrayBuffer: async () => copy.buffer };
    };
    const loaded = await loadHelpPdfImages(articles);
    assert.equal(Object.keys(loaded).length, refs.length);
    assert.deepEqual(requested.map(([src]) => src).sort(), refs.map((image) => image.src).sort());
    assert.ok(requested.every(([, credentials]) => credentials === "same-origin"));
    for (const image of refs) assert.deepEqual([loaded[image.src].width, loaded[image.src].height], [image.width, image.height]);
  } finally { global.fetch = originalFetch; }
});

test("unknown roles fail closed and output contains only ASCII", () => {
  assert.throws(() => createHelpPdf("unknown", getHelpArticles("agent")), /unknown role/);
  const pdf = render("agent");
  assert.ok(Buffer.from(pdf, "latin1").every((byte) => byte < 128));
});
