import { TextInput, TextArea } from "./form-controls";
"use client";

import { DragEvent, KeyboardEvent, useRef, useState } from "react";
import { caseDocumentConfig, validateCaseDocument } from "@/lib/document-config";
import type { CaseDocumentInput } from "@/lib/types";

export function CaseDocumentUpload({ id, type, files, multiple = false, error, uploading = false, progress = 0, onFilesChange, onError }: { id: string; type: CaseDocumentInput["type"]; files: File[]; multiple?: boolean; error?: string; uploading?: boolean; progress?: number; onFilesChange: (files: File[]) => void; onError: (message: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  function addFiles(incoming: FileList | File[]) {
    const next = Array.from(incoming);
    const invalid = next.map((file) => validateCaseDocument(file, type)).find(Boolean);
    if (invalid) { onError(invalid); return; }
    onError(null);
    onFilesChange(multiple ? [...files, ...next] : next.slice(0, 1));
  }
  function handleDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }
  function removeFile(index: number) { onFilesChange(files.filter((_, fileIndex) => fileIndex !== index)); onError(null); }
  return <div className={`case-upload ${dragging ? "case-upload-dragging" : ""} ${error ? "case-upload-error" : ""}`}>
    <TextInput ref={inputRef} className="sr-only" id={id} type="file" accept={caseDocumentConfig.acceptedExtensions} multiple={multiple} onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
    <div className="case-upload-dropzone" role="button" tabIndex={0} aria-describedby={error ? `${id}-error` : undefined} onClick={() => inputRef.current?.click()} onKeyDown={handleKeyDown} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
      <span className="payment-upload-icon" aria-hidden="true">↑</span><strong>{files.length ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Drop files here or browse"}</strong><span>PDF, JPG, PNG, or WEBP · up to 10 MB each</span>
    </div>
    {files.length > 0 && <div className="case-upload-files" aria-live="polite">{files.map((file, index) => <div className="case-upload-file" key={`${file.name}-${file.size}-${index}`}><div><strong>{file.name}</strong><span>{Math.ceil(file.size / 1024)} KB</span></div><button type="button" onClick={() => removeFile(index)} disabled={uploading}>Remove</button></div>)}</div>}
    {uploading && <div className="case-upload-progress" role="status"><span>Uploading documents…</span><strong>{progress}%</strong><div><i style={{ width: `${progress}%` }} /></div></div>}
    {!uploading && files.length > 0 && <p className="case-upload-success" role="status">Ready for submission.</p>}
    {error && <p id={`${id}-error`} className="case-upload-error-message" role="alert">{error}</p>}
  </div>;
}
