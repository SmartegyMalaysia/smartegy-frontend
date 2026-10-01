import type { HelpArticle, HelpSection } from "./help-guide";
import { HELP_REVISION } from "./help-guide";
import type { UserRole } from "./types";

export interface HelpPdfImage { bytes: Uint8Array; width: number; height: number; }
export type HelpPdfImages = Record<string, HelpPdfImage>;

type TextKind = "title" | "heading" | "subheading" | "body" | "small" | "toc" | "tocSection";
type TextBlock = { type: "text"; kind: TextKind; lines: string[]; targetId?: string; anchorId?: string; indent?: number };
type StepBlock = { type: "step"; number: number; lines: string[] };
type FlowBlock = { type: "flow"; items: NonNullable<HelpSection["flow"]> };
type MoneyBlock = { type: "money"; cards: NonNullable<HelpSection["moneyCards"]> };
type ImageBlock = { type: "image"; image: NonNullable<HelpSection["image"]> };
type PdfBlock = TextBlock | StepBlock | FlowBlock | MoneyBlock | ImageBlock;
type PdfPage = { blocks: PdfBlock[] };
type Destination = { pageIndex: number; y: number };
type LinkAnnotation = { targetId: string; rect: [number, number, number, number] };
type DrawnPage = { stream: string; links: LinkAnnotation[]; imageNames: Set<string> };

const PAGE_WIDTH = 612;
const LEFT = 52;
const RIGHT = 52;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const TOP = 710;
const BOTTOM = 54;

/** Fetch every illustration used by a role's guide. Missing images fail the whole download. */
export async function loadHelpPdfImages(articles: HelpArticle[]): Promise<HelpPdfImages> {
  const images = new Map<string, NonNullable<HelpSection["image"]>>();
  for (const article of articles) for (const section of article.sections) if (section.image) images.set(section.image.src, section.image);
  const entries = await Promise.all(Array.from(images.entries()).map(async ([src, spec]) => {
    if (!src.startsWith("/") || src.startsWith("//")) throw new Error(`Help image must use a same-origin path: ${src}`);
    const response = await fetch(src, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Could not load help image: ${src} (${response.status})`);
    if (!response.headers.get("content-type")?.toLocaleLowerCase().includes("image/jpeg")) throw new Error(`Help image is not a JPEG: ${src}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const dimensions = readJpegInfo(bytes);
    if (!dimensions || dimensions.width !== spec.width || dimensions.height !== spec.height) throw new Error(`Help image dimensions do not match the guide: ${src}`);
    return [src, { bytes, width: spec.width, height: spec.height }] as const;
  }));
  return Object.fromEntries(entries);
}

/** Build the complete, role-filtered PDF in memory. All detailed sections are included. */
export function createHelpPdf(role: UserRole, inputArticles: HelpArticle[], images: HelpPdfImages = {}): Uint8Array {
  if (!(role === "agent" || role === "staff" || role === "admin")) throw new Error("Cannot create a help PDF for an unknown role.");
  const articles = inputArticles.filter((article) => article.roles.includes(role));
  if (!articles.length) throw new Error("Cannot create a help PDF without visible articles.");

  const imageSpecs = new Map<string, NonNullable<HelpSection["image"]>>();
  for (const article of articles) for (const section of article.sections) if (section.image) imageSpecs.set(section.image.src, section.image);
  for (const src of Array.from(imageSpecs.keys())) if (!images[src]) throw new Error(`Missing help image: ${src}`);

  const cover: PdfPage = { blocks: [
    text("SMARTEGY", "small"),
    ...wrapped("Help & User Guide", 22, "title"),
    ...wrapped(roleLabel(role), 13, "heading"),
    ...wrapped(`Revised ${HELP_REVISION}`, 9, "small"),
    ...wrapped("Simple steps for the pages and tasks available to your role.", 11, "body"),
  ] };

  const tocBlocks: PdfBlock[] = [...wrapped("Contents", 22, "title"), ...wrapped(`${roleLabel(role)} - ${HELP_REVISION}`, 9, "small")];
  for (const article of articles) {
    tocBlocks.push(...wrappedTarget(article.title, 10, "toc", article.id));
    for (const section of article.sections) tocBlocks.push(...wrappedTarget(section.title, 9.5, "tocSection", `${article.id}#${section.id}`));
  }
  const tocPages = paginate(tocBlocks);
  const pages: PdfPage[] = [cover, ...tocPages];
  const destinations = new Map<string, Destination>();
  for (const article of articles) {
    const articlePages = paginate(articleBlocks(article));
    for (let pageIndex = 0; pageIndex < articlePages.length; pageIndex++) {
      const blocks = articlePages[pageIndex].blocks;
      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const block = blocks[blockIndex];
        if (block.type === "text" && block.anchorId) destinations.set(block.anchorId, { pageIndex: pages.length + pageIndex, y: destinationY(blocks, blockIndex) });
      }
    }
    pages.push(...articlePages);
  }

  const objectBodies: string[] = [];
  const addObject = (body: string) => { objectBodies.push(body); return objectBodies.length; };
  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const imageObjectIds = new Map<string, number>();
  const imageObjectNames = new Map<string, string>();
  const imageSpecsList = Array.from(imageSpecs.entries());
  for (let index = 0; index < imageSpecsList.length; index++) {
    const [src, spec] = imageSpecsList[index];
    const loaded = images[src];
    const components = readJpegInfo(loaded.bytes)?.components;
    if (!components || (components !== 1 && components !== 3)) throw new Error(`Unsupported JPEG color format: ${src}`);
    const colorSpace = components === 1 ? "/DeviceGray" : "/DeviceRGB";
    const encoded = toAsciiHex(loaded.bytes);
    const objectId = addObject(`<< /Type /XObject /Subtype /Image /Width ${spec.width} /Height ${spec.height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${encoded.length} >>\nstream\n${encoded}\nendstream`);
    imageObjectIds.set(src, objectId);
    imageObjectNames.set(src, `Im${index}`);
  }

  const pageIds = pages.map(() => addObject(""));
  const contentIds = pages.map(() => addObject(""));
  for (let index = 0; index < pages.length; index++) {
    const rendered = drawPage(pages[index], index + 1, pages.length, destinations, imageObjectNames);
    objectBodies[contentIds[index] - 1] = `<< /Length ${ascii(rendered.stream).length} >>\nstream\n${rendered.stream}\nendstream`;
    const annotations: number[] = [];
    for (const link of rendered.links) {
      const destination = destinations.get(link.targetId);
      if (!destination) continue;
      annotations.push(addObject(`<< /Type /Annot /Subtype /Link /Rect [${link.rect.join(" ")}] /Border [0 0 0] /Dest [${pageIds[destination.pageIndex]} 0 R /XYZ null ${destination.y.toFixed(2)} null] >>`));
    }
    const xobjects = Array.from(rendered.imageNames).map((name) => {
      const src = Array.from(imageObjectNames.entries()).find(([, objectName]) => objectName === name)?.[0];
      const objectId = src ? imageObjectIds.get(src) : undefined;
      return objectId ? `/${name} ${objectId} 0 R` : "";
    }).filter(Boolean);
    objectBodies[pageIds[index] - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>${xobjects.length ? ` /XObject << ${xobjects.join(" ")} >>` : ""} >> /Contents ${contentIds[index]} 0 R${annotations.length ? ` /Annots [${annotations.map((id) => `${id} 0 R`).join(" ")}]` : ""} >>`;
  }
  objectBodies[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objectBodies[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  return ascii(serialize(objectBodies, catalogId));
}

function articleBlocks(article: HelpArticle): PdfBlock[] {
  const blocks: PdfBlock[] = [
    ...wrapped(article.title, 20, "title", article.id),
    ...wrapped(article.summary, 9.5, "small"),
    text(`Category: ${article.category}`, "small"),
  ];
  if (article.taskLabel) blocks.push(...wrapped(`Task: ${article.taskLabel}`, 9, "small"));
  for (const section of article.sections) {
    blocks.push(...wrapped(section.title, 13, "heading", `${article.id}#${section.id}`));
    for (const paragraph of section.paragraphs ?? []) blocks.push(...wrapped(paragraph, 10.5, "body"));
    section.steps?.forEach((step, index) => blocks.push({ type: "step", number: index + 1, lines: wrapText(step, CONTENT_WIDTH - 42, 10.5) }));
    section.bullets?.forEach((bullet) => blocks.push(...wrapped(`- ${bullet}`, 10.5, "body", undefined, 8)));
    if (section.flow?.length) blocks.push({ type: "flow", items: section.flow });
    if (section.moneyCards?.length) blocks.push({ type: "money", cards: section.moneyCards });
    if (section.table) blocks.push(...tableBlocks(section.table));
    if (section.note) blocks.push(...wrapped(`Note: ${section.note}`, 9, "small"));
    if (section.image) blocks.push({ type: "image", image: section.image });
  }
  return blocks;
}

function tableBlocks(table: NonNullable<HelpSection["table"]>): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  for (const row of table.rows) row.forEach((cell, index) => {
    const kind = index === 0 ? "subheading" : "body";
    blocks.push(...wrapped(`${table.headers[index] ?? `Column ${index + 1}`}: ${cell}`, fontSize(kind), kind, undefined, index === 0 ? 0 : 10));
  });
  return blocks;
}

function wrapped(value: string, size: number, kind: TextKind, anchorId?: string, indent = 0): TextBlock[] {
  const lines = wrapText(value, Math.max(20, CONTENT_WIDTH - indent - 8), size);
  return lines.map((line, index) => ({ type: "text", kind, lines: [line], indent, anchorId: index === 0 ? anchorId : undefined }));
}

function text(value: string, kind: TextKind, targetId?: string): TextBlock { return { type: "text", kind, lines: [normalize(value)], targetId }; }

function wrappedTarget(value: string, size: number, kind: TextKind, targetId: string): TextBlock[] {
  return wrapped(value, size, kind).map((block, index) => ({ ...block, targetId: index === 0 ? targetId : undefined }));
}

function wrapText(value: string, maxWidth: number, size: number): string[] {
  const words = normalize(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (let word of words) {
    while (measureText(word, size) > maxWidth) {
      let split = 1;
      while (split < word.length && measureText(word.slice(0, split + 1), size) <= maxWidth) split++;
      if (current) { lines.push(current); current = ""; }
      lines.push(word.slice(0, split));
      word = word.slice(split);
    }
    const next = current ? `${current} ${word}` : word;
    if (current && measureText(next, size) > maxWidth) { lines.push(current); current = word; }
    else current = next;
  }
  if (current || !lines.length) lines.push(current);
  return lines;
}

function blockHeight(block: PdfBlock): number {
  if (block.type === "text") return textLineHeight(block.kind);
  if (block.type === "step") return 16 + block.lines.length * 14;
  if (block.type === "flow") {
    const columns = Math.min(3, block.items.length);
    const cardWidth = (CONTENT_WIDTH - (columns - 1) * 8) / columns;
    const rows = Math.ceil(block.items.length / columns);
    let height = 0;
    for (let row = 0; row < rows; row++) {
      const items = block.items.slice(row * columns, (row + 1) * columns);
      height += Math.max(...items.map((item) => 37 + wrapText(item.description ?? "", cardWidth - 16, 8.5).length * 11)) + 8;
    }
    return height;
  }
  if (block.type === "money") return 82;
  const width = Math.min(CONTENT_WIDTH, block.image.width * Math.min(CONTENT_WIDTH / block.image.width, 390 / block.image.height));
  const height = block.image.height * (width / block.image.width);
  const captionLines = imageCaptionLines(block.image).length;
  return height + 18 + captionLines * 10;
}

function textLineHeight(kind: TextKind): number {
  return kind === "title" ? 26 : kind === "heading" ? 19 : kind === "subheading" ? 15 : kind === "body" ? 14 : kind === "small" ? 13 : kind === "toc" ? 18 : 16;
}

function paginate(blocks: PdfBlock[]): PdfPage[] {
  const pages: PdfPage[] = [];
  let current: PdfBlock[] = [];
  let used = 0;
  const maxHeight = TOP - BOTTOM;
  for (const block of blocks) {
    const height = blockHeight(block);
    if (current.length && used + height > maxHeight) { pages.push({ blocks: current }); current = []; used = 0; }
    current.push(block);
    used += height;
  }
  if (current.length || !pages.length) pages.push({ blocks: current });
  return pages;
}

function destinationY(blocks: PdfBlock[], targetIndex: number): number {
  let cursor = TOP;
  for (let index = 0; index <= targetIndex; index++) cursor -= blockHeight(blocks[index]);
  const block = blocks[targetIndex];
  const line = block.type === "text" ? block.lines[0] : "";
  const size = block.type === "text" ? fontSize(block.kind) : 10;
  return cursor + Math.max(2, (blockHeight(block) - size) / 2) + 4;
}

function drawPage(page: PdfPage, pageNumber: number, pageCount: number, destinations: Map<string, Destination>, imageNames: Map<string, string>): DrawnPage {
  const ops = ["q", "0.16 0.23 0.50 rg", `BT /F2 9 Tf 52 760 Td (${pdfEscape("SMARTEGY  |  HELP & USER GUIDE")}) Tj ET`, "0.82 0.86 0.90 RG", "0.6 w 52 750 m 560 750 l S"];
  const links: LinkAnnotation[] = [];
  const usedImages = new Set<string>();
  let cursor = TOP;
  for (const block of page.blocks) {
    const height = blockHeight(block);
    cursor -= height;
    if (block.type === "text") {
      const kind = block.kind;
      const size = fontSize(kind);
      const color = kind === "title" || kind === "heading" ? "0.16 0.23 0.50" : kind === "small" ? "0.34 0.40 0.48" : "0.12 0.17 0.25";
      const bold = ["title", "heading", "subheading", "toc"].includes(kind);
      const indent = block.indent ?? (kind === "tocSection" ? 14 : 0);
      const baseline = cursor + Math.max(2, (height - size) / 2);
      const line = block.lines[0];
      ops.push(`${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${LEFT + indent} ${baseline.toFixed(2)} Td (${pdfEscape(line)}) Tj ET`);
      if (block.targetId) {
        const destination = destinations.get(block.targetId);
        if (destination) {
          const pageLabel = String(destination.pageIndex + 1);
          const x = PAGE_WIDTH - RIGHT - measureText(pageLabel, 9);
          ops.push(`0.34 0.40 0.48 rg BT /F1 9 Tf ${x.toFixed(2)} ${baseline.toFixed(2)} Td (${pageLabel}) Tj ET`);
          links.push({ targetId: block.targetId, rect: [LEFT - 2, baseline - 3, PAGE_WIDTH - RIGHT, baseline + 11] });
        }
      }
    } else if (block.type === "step") {
      const boxTop = cursor + height - 3;
      ops.push("0.90 0.94 0.98 rg", `${LEFT} ${boxTop - 22} 24 22 re f`, `0.16 0.23 0.50 rg BT /F2 9 Tf ${LEFT + 9} ${boxTop - 15} Td (${block.number}) Tj ET`);
      block.lines.forEach((line, index) => ops.push(`0.12 0.17 0.25 rg BT /F1 10.5 Tf ${LEFT + 34} ${(boxTop - 12 - index * 14).toFixed(2)} Td (${pdfEscape(line)}) Tj ET`));
    } else if (block.type === "flow") {
      drawFlow(ops, block, cursor + height);
    } else if (block.type === "money") {
      drawMoneyCards(ops, block, cursor + height);
    } else {
      const name = imageNames.get(block.image.src);
      if (!name) throw new Error(`Missing embedded help image: ${block.image.src}`);
      const width = Math.min(CONTENT_WIDTH, block.image.width * Math.min(CONTENT_WIDTH / block.image.width, 390 / block.image.height));
      const imageHeight = block.image.height * (width / block.image.width);
      const captionLines = imageCaptionLines(block.image);
      const captionHeight = captionLines.length * 10;
      const x = LEFT + (CONTENT_WIDTH - width) / 2;
      const y = cursor + height - imageHeight - 6;
      ops.push("0.94 0.96 0.98 rg", `${x.toFixed(2)} ${(y - 3).toFixed(2)} ${width.toFixed(2)} ${(imageHeight + 6).toFixed(2)} re f`, "q", `${width.toFixed(2)} 0 0 ${imageHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`, `/${name} Do`, "Q");
      captionLines.forEach((line, lineIndex) => ops.push(`0.34 0.40 0.48 rg BT /F1 8.5 Tf ${LEFT} ${(cursor + 4 + (captionLines.length - lineIndex - 1) * 10).toFixed(2)} Td (${pdfEscape(line)}) Tj ET`));
      usedImages.add(name);
    }
  }
  ops.push("0.82 0.86 0.90 RG", "0.6 w 52 40 m 560 40 l S", "0.34 0.40 0.48 rg", `BT /F1 8 Tf 52 25 Td (${pdfEscape(`Revised ${HELP_REVISION}`)}) Tj ET`, `BT /F1 8 Tf 500 25 Td (${pageNumber} / ${pageCount}) Tj ET`, "Q");
  return { stream: ops.join("\n"), links, imageNames: usedImages };
}

function drawFlow(ops: string[], block: FlowBlock, top: number) {
  const columns = Math.min(3, block.items.length);
  const gap = 8;
  const width = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  let y = top;
  for (let index = 0; index < block.items.length; index += columns) {
    const row = block.items.slice(index, index + columns);
    const heights = row.map((item) => 37 + wrapText(item.description ?? "", width - 16, 8.5).length * 11);
    const rowHeight = Math.max(...heights);
    row.forEach((item, itemIndex) => {
      const x = LEFT + itemIndex * (width + gap);
      const cardTop = y;
      ops.push("0.92 0.96 0.97 rg", `${x.toFixed(2)} ${(cardTop - rowHeight).toFixed(2)} ${width.toFixed(2)} ${rowHeight.toFixed(2)} re f`, "0.78 0.86 0.90 RG", `${x.toFixed(2)} ${(cardTop - rowHeight).toFixed(2)} ${width.toFixed(2)} ${rowHeight.toFixed(2)} re S`);
      ops.push(`0.16 0.23 0.50 rg BT /F2 9 Tf ${(x + 8).toFixed(2)} ${(cardTop - 15).toFixed(2)} Td (${pdfEscape(`${index + itemIndex + 1}. ${item.label}`)}) Tj ET`);
      wrapText(item.description ?? "", width - 16, 8.5).forEach((line, lineIndex) => ops.push(`0.18 0.23 0.30 rg BT /F1 8.5 Tf ${(x + 8).toFixed(2)} ${(cardTop - 29 - lineIndex * 11).toFixed(2)} Td (${pdfEscape(line)}) Tj ET`));
      if (itemIndex < row.length - 1) {
        const arrowX = x + width + 1;
        ops.push(`0.20 0.55 0.55 RG 1.2 w ${arrowX.toFixed(2)} ${(cardTop - rowHeight / 2).toFixed(2)} m ${(arrowX + gap - 2).toFixed(2)} ${(cardTop - rowHeight / 2).toFixed(2)} l S`);
      }
    });
    y -= rowHeight + gap;
  }
}

function drawMoneyCards(ops: string[], block: MoneyBlock, top: number) {
  const gap = 8;
  const width = (CONTENT_WIDTH - gap * (block.cards.length - 1)) / block.cards.length;
  block.cards.forEach((card, index) => {
    const x = LEFT + index * (width + gap);
    ops.push("0.95 0.97 0.99 rg", `${x.toFixed(2)} ${(top - 77).toFixed(2)} ${width.toFixed(2)} 74 re f`, "0.80 0.86 0.90 RG", `${x.toFixed(2)} ${(top - 77).toFixed(2)} ${width.toFixed(2)} 74 re S`);
    ops.push(`0.34 0.40 0.48 rg BT /F1 8.5 Tf ${(x + 8).toFixed(2)} ${(top - 18).toFixed(2)} Td (${pdfEscape(card.label)}) Tj ET`);
    ops.push(`0.16 0.23 0.50 rg BT /F2 13 Tf ${(x + 8).toFixed(2)} ${(top - 40).toFixed(2)} Td (${pdfEscape(card.amount)}) Tj ET`);
    if (card.note) wrapText(card.note, width - 16, 7.5).slice(0, 2).forEach((line, lineIndex) => ops.push(`0.34 0.40 0.48 rg BT /F1 7.5 Tf ${(x + 8).toFixed(2)} ${(top - 55 - lineIndex * 9).toFixed(2)} Td (${pdfEscape(line)}) Tj ET`));
  });
}

function imageCaptionLines(image: NonNullable<HelpSection["image"]>): string[] {
  return [...wrapText(`Image: ${image.alt}`, CONTENT_WIDTH, 8.5), ...wrapText(image.caption, CONTENT_WIDTH, 8.5)];
}

function fontSize(kind: TextKind): number { return kind === "title" ? 20 : kind === "heading" ? 13 : kind === "subheading" ? 10 : kind === "body" ? 10.5 : kind === "small" ? 9 : kind === "toc" ? 10 : 9.5; }

function measureText(value: string, size: number): number {
  let units = 0;
  for (const char of value) {
    if (" ilI!.,:;'|".includes(char)) units += 0.24;
    else if ("MW@%&".includes(char)) units += 0.82;
    else if (char === " ") units += 0.28;
    else if (/[A-Z]/.test(char)) units += 0.62;
    else if (/[0-9]/.test(char)) units += 0.56;
    else units += 0.51;
  }
  return units * size;
}

function roleLabel(role: UserRole): string { return role === "admin" ? "Admin guide" : role === "staff" ? "Staff guide" : "Agent guide"; }

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u00b7/g, " - ").replace(/\u00d7/g, " x ").replace(/\u2026/g, "...").replace(/\u00a0/g, " ").replace(/[^\x20-\x7e]/g, "?");
}

function pdfEscape(value: string): string { return normalize(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function ascii(value: string): Uint8Array { return Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 0xff)); }
function toAsciiHex(bytes: Uint8Array): string { return `${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}>`; }

function readJpegInfo(bytes: Uint8Array): { width: number; height: number; components: number } | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return undefined;
  let index = 2;
  while (index + 9 < bytes.length) {
    if (bytes[index] !== 0xff) { index++; continue; }
    const marker = bytes[index + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = (bytes[index + 2] << 8) | bytes[index + 3];
    if (length < 2 || index + 2 + length > bytes.length) return undefined;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: (bytes[index + 5] << 8) | bytes[index + 6], width: (bytes[index + 7] << 8) | bytes[index + 8], components: bytes[index + 9] };
    }
    index += 2 + length;
  }
  return undefined;
}

function serialize(objects: string[], rootId: number): string {
  let result = "%PDF-1.4\n%SMARTEGY\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(ascii(result).length);
    result += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = ascii(result).length;
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) result += `${String(offset).padStart(10, "0")} 00000 n \n`;
  result += `trailer\n<< /Size ${objects.length + 1} /Root ${rootId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return result;
}
