"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./ui";
import { FormField, TextInput } from "./form-controls";
import { FilterSelect } from "./filter-select";
import { Icon } from "./icons";
import { MALAYSIAN_BANKS } from "@/lib/malaysian-banks";
import { bankDetailsRepository } from "@/lib/bank-details-repository";
import type { CurrentUser, UpdateAgentBankDetailsInput } from "@/lib/types";

const OTHER_BANK_OPTION = "Other";
const BANK_OPTIONS = [...MALAYSIAN_BANKS, OTHER_BANK_OPTION] as const;

export function FirstLoginBankDetails({ user, onComplete }: { user: CurrentUser; onComplete: () => void }) {
  const [bankSelection, setBankSelection] = useState("");
  const [otherBankName, setOtherBankName] = useState("");
  const [form, setForm] = useState<UpdateAgentBankDetailsInput>({ bankName: "", accountHolderName: "", accountNumber: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(field: keyof UpdateAgentBankDetailsInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: [] }));
    setFeedback(null);
  }

  function selectBank(value: string) {
    setBankSelection(value);
    update("bankName", value === OTHER_BANK_OPTION ? otherBankName : value);
  }

  function selectOtherBank(value: string) {
    setOtherBankName(value);
    update("bankName", value);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    const result = await bankDetailsRepository.updateMine(user, form);
    setSaving(false);
    if (!result.ok) {
      setFieldErrors(result.error.fieldErrors ?? {});
      setFeedback(result.error.message);
      return;
    }
    onComplete();
  }

  return <main className="page-content first-login-page">
    <div className="first-login-layout">
      <section className="first-login-intro">
        <span className="first-login-step" aria-hidden="true"><Icon name="check" size={18} /></span>
        <p className="eyebrow">One-time setup</p>
        <h1>Set Up Your Payout Details</h1>
        <p>Before you enter the workspace, add the bank account that Smartegy should use for your commission payouts.</p>
        <div className="first-login-trust-note"><Icon name="wallet" size={16} /><span>Your details are saved securely and can be updated later from your profile.</span></div>
      </section>

      <section className="panel first-login-card">
        <div className="panel-header">
          <div><p className="eyebrow">Required before access</p><h2>Bank Details</h2><p>Use the account holder name exactly as it appears on the bank account.</p></div>
        </div>
        <form className="first-login-form" onSubmit={submit} noValidate>
          <FormField title="Bank name" required>
            <FilterSelect id="first-login-bank" allLabel="Select a bank" value={bankSelection} options={[...BANK_OPTIONS]} onChange={selectBank} ariaLabel="Bank name" ariaInvalid={Boolean(fieldErrors.bankName?.[0])} required />
          </FormField>
          {bankSelection === OTHER_BANK_OPTION && <Field id="first-login-other-bank" label="Other bank name" value={otherBankName} onChange={selectOtherBank} error={fieldErrors.bankName?.[0]} autoComplete="organization" />}
          <Field id="first-login-account-holder" label="Account holder name" value={form.accountHolderName} onChange={(value) => update("accountHolderName", value)} error={fieldErrors.accountHolderName?.[0]} autoComplete="name" />
          <Field id="first-login-account-number" label="Bank account number" value={form.accountNumber} onChange={(value) => update("accountNumber", value)} error={fieldErrors.accountNumber?.[0]} autoComplete="off" inputMode="numeric" />
          {feedback && <p className="first-login-feedback" role="alert">{feedback}</p>}
          <div className="first-login-actions"><Button type="submit" loading={saving}>Save And Continue</Button><span>This takes less than a minute.</span></div>
        </form>
      </section>
    </div>
  </main>;
}

function Field({ id, label, value, onChange, error, autoComplete, inputMode }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; autoComplete: string; inputMode?: "numeric" | "text" }) {
  return <FormField title={label} htmlFor={id} required className={error ? "first-login-field first-login-field-error" : "first-login-field"}>
    <TextInput id={id} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} inputMode={inputMode} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
    {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
  </FormField>;
}
