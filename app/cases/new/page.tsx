"use client";

import { FormField, TextInput, TextArea } from "@/components/form-controls";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CaseDocumentUpload } from "@/components/case-document-upload";
import { FilterSelect } from "@/components/filter-select";
import { Toast, type ToastTone } from "@/components/toast";
import { Button, ConfirmationDialog, ErrorState } from "@/components/ui";
import { casesRepository } from "@/lib/case-repository";
import { usePreviewUser } from "@/lib/preview-user";
import type { CurrentUser } from "@/lib/types";

type CaseToast = { title: string; subtitle: string; tone: ToastTone };

export default function NewCasePage() {
  const { user: agent } = usePreviewUser("agent");
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [billFiles, setBillFiles] = useState<File[]>([]);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [billError, setBillError] = useState<string | null>(null);
  const [supportingError, setSupportingError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [toast, setToast] = useState<CaseToast | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null); setToast(null); setPermissionDenied(false);
    if (!customerName.trim()) { setFieldError("Enter the customer or company name."); return; }
    if (!billFiles.length) { setBillError("Upload the latest electricity bill before submitting."); return; }
    setConfirmationOpen(true);
  }
  function confirmSubmit() {
    setConfirmationOpen(false);
    setSubmitting(true); setProgress(5);
    const siteAddress = [addressLine1, addressLine2, [postcode, city].filter(Boolean).join(" "), state].filter(Boolean).join(", ");
    casesRepository.create(agent, { customer: { displayName: customerName, contactName, email, phone }, service: { siteAddress, notes }, documents: [{ type: "electricity_bill", fileName: billFiles[0].name, mimeType: billFiles[0].type, sizeBytes: billFiles[0].size, file: billFiles[0] }, ...supportingFiles.map((file) => ({ type: "supporting_document" as const, fileName: file.name, mimeType: file.type, sizeBytes: file.size, file }))] }, setProgress).then((result) => { if (result.ok) router.push(`/cases/${result.data.id}`); else if (result.error.code === "FORBIDDEN") setPermissionDenied(true); else setToast({ title: "Submission Failed", subtitle: result.error.message, tone: "error" }); }).finally(() => setSubmitting(false));
  }

  return <AppShell user={agent} onRoleChange={() => undefined}><main className="page-content case-create-page"><div className="case-create-header"><div><Link className="back-link" href="/dashboard" aria-label="Back to dashboard"><span aria-hidden="true">&lt;</span> Back to dashboard</Link><p className="eyebrow">Case submission</p><h1>Submit a New Case</h1><p className="page-description">Share the customer and service details Smartegy needs to review the opportunity.</p></div></div>{permissionDenied ? <ErrorState onRetry={() => setPermissionDenied(false)} /> : <form className="case-create-form" onSubmit={submit} noValidate><section className="panel case-form-panel"><div className="panel-header"><div><h2>Customer Details</h2><p>Enter the customer information for staff review.</p></div></div><div className="case-form-body"><div className="case-form-grid"><Field id="company-name" label="Company Name" value={customerName} onChange={setCustomerName} required error={fieldError ?? undefined} /><Field id="company-email" label="Company Email Address" value={email} onChange={setEmail} type="email" required /><Field id="contact-person-name" label="Contact Person Name" value={contactName} onChange={setContactName} required /><Field id="contact-person-phone" label="Contact Person Phone Number" value={phone} onChange={setPhone} type="tel" required /><Field id="address-line-1" label="Address Line 1" value={addressLine1} onChange={setAddressLine1} required autoComplete="address-line1" /><Field id="address-line-2" label="Address Line 2" value={addressLine2} onChange={setAddressLine2} optional autoComplete="address-line2" /><Field id="postcode" label="Postcode" value={postcode} onChange={setPostcode} required autoComplete="postal-code" /><Field id="city" label="City" value={city} onChange={setCity} required autoComplete="address-level2" /><SelectField id="state" label="State" value={state} onChange={setState} required options={["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah", "Sarawak", "Selangor", "Terengganu"]} /><TextAreaField id="additional-remarks" label="Additional Remarks" value={notes} onChange={setNotes} optional placeholder="Add context for staff if needed" /></div></div></section><section className="panel case-form-panel case-documents-panel"><div className="panel-header"><div><h2>Documents for Staff Review</h2><p>Upload only what is available. The latest electricity bill is the only required document.</p></div></div><div className="case-form-body"><div className="case-upload-section case-upload-required"><div className="case-upload-heading"><div><h3>Latest Electricity Bill <span className="required-mark"> *</span></h3><p>Required to submit the case.</p></div><span className="case-required-label">Required</span></div><CaseDocumentUpload id="latest-electricity-bill" type="electricity_bill" files={billFiles} error={billError ?? undefined} uploading={submitting} progress={progress} onFilesChange={(files) => { setBillFiles(files.slice(0, 1)); setBillError(null); }} onError={setBillError} /></div><div className="case-upload-section"><div className="case-upload-heading"><div><h3>Other Supporting Documents</h3><p>Use this for additional information requested by Smartegy staff.</p></div></div><CaseDocumentUpload id="supporting-documents" type="supporting_document" files={supportingFiles} multiple error={supportingError ?? undefined} uploading={submitting} progress={progress} onFilesChange={setSupportingFiles} onError={setSupportingError} /></div></div></section><div className="case-submit-actions"><Button type="submit" disabled={submitting}>{submitting ? `Submitting… ${progress}%` : "Submit"}</Button></div></form>}{toast && <Toast title={toast.title} subtitle={toast.subtitle} tone={toast.tone} onDismiss={() => setToast(null)} />}{confirmationOpen && <ConfirmationDialog open title="Submit This Case?" description="Your case and uploaded documents will be sent to Smartegy staff for review. Review normally takes 1–3 business days." confirmLabel="Confirm Submission" confirmVariant="primary" onCancel={() => setConfirmationOpen(false)} onConfirm={confirmSubmit} />}</main></AppShell>;
}

function SelectField({ id, label, value, onChange, options, required = false, optional = false }: { id: string; label: string; value: string; onChange: (value: string) => void; options: string[]; required?: boolean; optional?: boolean }) { return <FormField title={label} required={required}><FilterSelect allLabel={`Select ${label.toLowerCase()}`} value={value} options={options} onChange={onChange} /></FormField>; }

function TextAreaField({ id, label, value, onChange, optional = false, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; optional?: boolean; placeholder?: string }) { return <TextArea id={id} title={label} rows={1} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />; }

function Field({ id, label, value, onChange, type = "text", required = false, optional = false, autoComplete, error }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; optional?: boolean; autoComplete?: string; error?: string }) { return <TextInput id={id} title={label} fieldClassName={error ? "case-field-error" : ""} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />; }
