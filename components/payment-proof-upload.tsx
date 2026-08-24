"use client";

import { TextInput, TextArea } from "./form-controls";
import { DragEvent, KeyboardEvent, useRef, useState } from "react";
import { caseDocumentConfig, validateCaseDocument, validateFileSignature } from "@/lib/document-config";

export function PaymentProofUpload({
  name = "proof",
  required = false,
  error,
  onFileChange,
}: {
  name?: string;
  required?: boolean;
  error?: string;
  onFileChange?: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  async function acceptFile(nextFile: File | undefined) {
    if (nextFile) {
      const metadataError = validateCaseDocument(nextFile, "supporting_document");
      const signatureError = metadataError ? null : await validateFileSignature(nextFile);
      const nextError = metadataError ?? signatureError;
      if (nextError) {
        setValidationError(nextError);
        setFile(null);
        onFileChange?.(null);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }
    setValidationError(null);
    setFile(nextFile ?? null);
    onFileChange?.(nextFile ?? null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void acceptFile(event.dataTransfer.files[0]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  return (
    <div
      className={`payment-upload ${dragging ? "payment-upload-dragging" : ""} ${error || validationError ? "payment-upload-error-state" : ""}`}
    >
      <TextInput
        ref={inputRef}
        className="sr-only"
        id={name}
        name={name}
        type="file"
        accept={caseDocumentConfig.acceptedExtensions}
        required={required}
        onChange={(event) => void acceptFile(event.target.files?.[0])}
      />
      <div
        className="payment-upload-dropzone"
        role="button"
        tabIndex={0}
        aria-describedby={error || validationError ? `${name}-error` : undefined}
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <span className="payment-upload-icon" aria-hidden="true">
          ↑
        </span>
        <strong>{file ? file.name : "Drop your proof of payment here"}</strong>
        <span>
          {file
            ? `${Math.ceil(file.size / 1024)} KB · Ready to submit`
            : "or click to browse · PDF, JPG, or PNG"}
        </span>
      </div>
      {file && (
        <button
          className="payment-upload-remove"
          type="button"
          onClick={() => {
            setFile(null);
            setValidationError(null);
            onFileChange?.(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          Remove file
        </button>
      )}
      {error && (
        <p
          id={`${name}-error`}
          className="payment-upload-error-message"
          role="alert"
        >
          {error}
        </p>
      )}
      {!error && validationError && <p id={`${name}-error`} className="payment-upload-error-message" role="alert">{validationError}</p>}
    </div>
  );
}
