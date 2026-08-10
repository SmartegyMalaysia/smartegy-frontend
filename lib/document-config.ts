import type { DocumentType } from "./types";

export const caseDocumentConfig = {
  maxSizeBytes: 10 * 1024 * 1024,
  acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const,
  acceptedExtensions: ".pdf,.jpg,.jpeg,.png,.webp",
};

export function validateCaseDocument(file: Pick<File, "name" | "type" | "size">, type: DocumentType) {
  if (!caseDocumentConfig.acceptedMimeTypes.includes(file.type as typeof caseDocumentConfig.acceptedMimeTypes[number])) return "Upload a PDF, JPG, PNG, or WEBP file.";
  if (file.size > caseDocumentConfig.maxSizeBytes) return "Each file must be 10 MB or smaller.";
  if (type !== "electricity_bill" && type !== "supporting_document") return "This document type is not available for case submission.";
  return null;
}
