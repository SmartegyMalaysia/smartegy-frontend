"use client";

import { TextInput, TextArea } from "./form-controls";
import { DragEvent, KeyboardEvent, useRef, useState } from "react";

export function PaymentProofUpload({ name = "proof", required = false, error, onFileChange }: { name?: string; required?: boolean; error?: string; onFileChange?: (file: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  function acceptFile(nextFile: File | undefined) {
    setFile(nextFile ?? null);
    onFileChange?.(nextFile ?? null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  return <div className={`payment-upload ${dragging ? "payment-upload-dragging" : ""} ${error ? "payment-upload-error-state" : ""}`}>
    <TextInput ref={inputRef} className="sr-only" id={name} name={name} type="file" accept="image/*,.pdf" required={required} onChange={(event) => acceptFile(event.target.files?.[0])} />
    <div className="payment-upload-dropzone" role="button" tabIndex={0} aria-describedby={error ? `${name}-error` : undefined} onClick={() => inputRef.current?.click()} onKeyDown={handleKeyDown} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
      <span className="payment-upload-icon" aria-hidden="true">↑</span>
      <strong>{file ? file.name : "Drop your proof of payment here"}</strong>
      <span>{file ? `${Math.ceil(file.size / 1024)} KB · Ready to submit` : "or click to browse · PDF, JPG, or PNG"}</span>
    </div>
    {file && <button className="payment-upload-remove" type="button" onClick={() => { setFile(null); onFileChange?.(null); if (inputRef.current) inputRef.current.value = ""; }}>Remove file</button>}
    {error && <p id={`${name}-error`} className="payment-upload-error-message" role="alert">{error}</p>}
  </div>;
}
