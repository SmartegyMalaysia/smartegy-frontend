"use client";

import { useState } from "react";
import { Button } from "./ui";
import { TextInput } from "./form-controls";
import { FilterSelect } from "./filter-select";
import { DatePicker } from "./date-picker";
import { PaymentProofUpload } from "./payment-proof-upload";
import { PopupModal } from "./popup-modal";
import { casesRepository } from "@/lib/case-repository";
import type { CaseDetail, CurrentUser } from "@/lib/types";

export function ProposalAcceptance({ caseDetail, user, onChanged, onClose }: { caseDetail: CaseDetail; user: CurrentUser; onChanged: (value: CaseDetail) => void; onClose: () => void }) {
  const [acceptedByName, setAcceptedByName] = useState(caseDetail.proposal?.acceptedByName ?? caseDetail.customer.contactName ?? "");
  const [acceptanceDate, setAcceptanceDate] = useState(caseDetail.proposal?.acceptanceDate ?? new Date().toISOString().slice(0, 10));
  const [depositDue, setDepositDue] = useState(caseDetail.proposal?.acceptanceDate ?? new Date().toISOString().slice(0, 10));
  const [postInstallationDue, setPostInstallationDue] = useState(() => { const date = new Date(); date.setDate(date.getDate() + 14); return date.toISOString().slice(0, 10); });
  const [term, setTerm] = useState<10 | 20>(caseDetail.proposal?.selectedTermMonths ?? 10);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!caseDetail.proposal || !acceptedByName.trim() || !acceptanceDate || !depositDue || !postInstallationDue || !file) { setError("Acceptance name, both payment due dates, and the signed proposal file are required."); return; }
    if (postInstallationDue < depositDue) { setError("Post-installation due date cannot precede the deposit due date."); return; }
    setBusy(true); setError(null);
    const result = await casesRepository.acceptProposal(user, caseDetail.id, { proposalId: caseDetail.proposal.id, acceptedByName, acceptanceDate, depositDue, postInstallationDue, selectedTermMonths: term, signedProposal: file });
    if (result.ok) { onChanged(result.data); onClose(); } else setError(result.error.message);
    setBusy(false);
  }

  return <PopupModal open title="Accept Proposal" description="Upload the signed proposal, record the customer's acceptance, select the payment option, and issue the deposit invoice." size="sm" onClose={onClose} closeOnBackdrop={false} hasUnsavedChanges={!busy}>
    <div className="proposal-acceptance-form">
      <TextInput title="Accepted By" value={acceptedByName} onChange={(event) => setAcceptedByName(event.target.value)} required />
      <DatePicker id="acceptance-date" title="Acceptance Date" value={acceptanceDate} onChange={setAcceptanceDate} required />
      <DatePicker id="deposit-due" title="Deposit Due" value={depositDue} onChange={setDepositDue} required />
      <DatePicker id="post-installation-due" title="Post-Installation Due" value={postInstallationDue} onChange={setPostInstallationDue} required />
      <FilterSelect title="Payment Option" allLabel="Select payment option" value={String(term) as "10" | "20"} options={["10", "20"]} labels={{ "10": "10 Months", "20": "20 Months" }} onChange={(value) => setTerm(Number(value) as 10 | 20)} required />
      <div className="case-field proposal-signed-upload"><span>Signed Proposal <span className="required-mark">*</span></span><PaymentProofUpload name="signed-proposal" documentType="signed_proposal" emptyLabel="Drop signed proposal here" browseLabel="or click to browse · PDF, JPG, or PNG" required onFileChange={setFile} /></div>
      {error && <p className="case-field-error-message" role="alert">{error}</p>}
      <div className="proposal-form-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="button" variant="primary" onClick={submit} disabled={busy}>{busy ? "Processing…" : "Accept Proposal & Issue Deposit Invoice"}</Button></div>
    </div>
  </PopupModal>;
}
