import type { DocumentType } from "./types";

export const caseDocumentConfig = {
  maxSizeBytes: 10 * 1024 * 1024,
  acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const,
  acceptedExtensions: ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif",
};

const extensionMimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export function getDocumentMimeType(file: Pick<File, "name" | "type">) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return file.type || extensionMimeTypes[extension] || "application/octet-stream";
}

export function validateCaseDocument(file: Pick<File, "name" | "type" | "size">, type: DocumentType) {
  const mimeType = getDocumentMimeType(file);
  if (!caseDocumentConfig.acceptedMimeTypes.includes(mimeType as typeof caseDocumentConfig.acceptedMimeTypes[number])) return "Upload a PDF, JPG, PNG, WEBP, HEIC, or HEIF file.";
  if (file.size <= 0) return "The selected file is empty.";
  if (file.size > caseDocumentConfig.maxSizeBytes) return "Each file must be 10 MB or smaller.";
  if (type !== "electricity_bill" && type !== "supporting_document" && type !== "payment_proof" && type !== "signed_proposal") return "This document type is not available for upload.";
  return null;
}

const signatures: Record<(typeof caseDocumentConfig.acceptedMimeTypes)[number], (bytes: Uint8Array) => boolean> = {
  "application/pdf": (bytes) => bytes.length >= 5 && String.fromCharCode(...Array.from(bytes.slice(0, 5))) === "%PDF-",
  "image/jpeg": (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value),
  "image/webp": (bytes) => bytes.length >= 12
    && String.fromCharCode(...Array.from(bytes.slice(0, 4))) === "RIFF"
    && String.fromCharCode(...Array.from(bytes.slice(8, 12))) === "WEBP",
  "image/heic": (bytes) => isHeifSignature(bytes),
  "image/heif": (bytes) => isHeifSignature(bytes),
};

function isHeifSignature(bytes: Uint8Array) {
  if (bytes.length < 12 || String.fromCharCode(...Array.from(bytes.slice(4, 8))) !== "ftyp") return false;
  const brand = String.fromCharCode(...Array.from(bytes.slice(8, 12)));
  return ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand);
}

export async function validateFileSignature(file: File) {
  const validator = signatures[file.type as keyof typeof signatures];
  if (!validator) return "Upload a PDF, JPG, PNG, WEBP, HEIC, or HEIF file.";
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return validator(bytes) ? null : "The file contents do not match the selected file type.";
}
