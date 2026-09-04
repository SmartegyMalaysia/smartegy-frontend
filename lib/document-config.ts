import type { DocumentType } from "./types";

export const caseDocumentConfig = {
  maxSizeBytes: 10 * 1024 * 1024,
  acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const,
  acceptedExtensions: ".pdf,.jpg,.jpeg,.png,.webp",
};

export function validateCaseDocument(file: Pick<File, "name" | "type" | "size">, type: DocumentType) {
  if (!caseDocumentConfig.acceptedMimeTypes.includes(file.type as typeof caseDocumentConfig.acceptedMimeTypes[number])) return "Upload a PDF, JPG, PNG, or WEBP file.";
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
};

export async function validateFileSignature(file: File) {
  const validator = signatures[file.type as keyof typeof signatures];
  if (!validator) return "Upload a PDF, JPG, PNG, or WEBP file.";
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return validator(bytes) ? null : "The file contents do not match the selected file type.";
}
