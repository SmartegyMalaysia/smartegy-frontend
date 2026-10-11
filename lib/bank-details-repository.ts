import { getSupabaseBrowserClient, isSupabaseConfigured, normalizeSupabaseError } from "./supabase-browser";
import type { AgentBankDetails, CurrentUser, ProfileActionResult, UpdateAgentBankDetailsInput } from "./types";

export type BankDetails = AgentBankDetails;

function failure<T>(error: unknown, fieldErrors?: Record<string, string[]>): ProfileActionResult<T> {
  const normalized = normalizeSupabaseError(error as { code?: string; message?: string });
  return {
    ok: false,
    error: {
      code: normalized.code === "FORBIDDEN" ? "FORBIDDEN" : normalized.code === "NOT_FOUND" ? "NOT_FOUND" : normalized.code === "DUPLICATE" ? "CONFLICT" : "INTERNAL_ERROR",
      message: normalized.message,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
  };
}

function validate(input: UpdateAgentBankDetailsInput) {
  const fieldErrors: Record<string, string[]> = {};
  if (input.bankName.trim().length < 2) fieldErrors.bankName = ["Enter the bank name."];
  if (input.accountHolderName.trim().length < 2) fieldErrors.accountHolderName = ["Enter the account holder name."];
  if (input.accountNumber.trim().length < 4) fieldErrors.accountNumber = ["Enter a valid bank account number."];
  return fieldErrors;
}

export interface BankDetailsRepository {
  getMine(actor: CurrentUser): Promise<ProfileActionResult<BankDetails | null>>;
  updateMine(actor: CurrentUser, input: UpdateAgentBankDetailsInput): Promise<ProfileActionResult<BankDetails>>;
}

const mockBankDetails: Record<string, BankDetails> = {
  "user-001": { bankName: "Malayan Banking Berhad (Maybank)", accountHolderName: "Aisha Rahman", accountNumber: "1234567890" },
};
let mockDetails = structuredClone(mockBankDetails);

function mockAccess(actor: CurrentUser) {
  if (!actor.agentId && actor.role === "agent") return failure<BankDetails | null>({ code: "42501", message: "Your agent account could not be identified." });
  return null;
}

export const mockBankDetailsRepository: BankDetailsRepository = {
  async getMine(actor) {
    const denied = mockAccess(actor);
    if (denied) return denied;
    return { ok: true, data: mockDetails[actor.id] ? structuredClone(mockDetails[actor.id]) : null };
  },
  async updateMine(actor, input) {
    const denied = mockAccess(actor);
    if (denied) return denied as ProfileActionResult<BankDetails>;
    const fieldErrors = validate(input);
    if (Object.keys(fieldErrors).length) return failure<BankDetails>({ message: "Check the highlighted bank details and try again." }, fieldErrors);
    const saved = { bankName: input.bankName.trim(), accountHolderName: input.accountHolderName.trim(), accountNumber: input.accountNumber.trim() };
    mockDetails[actor.id] = saved;
    return { ok: true, data: structuredClone(saved) };
  },
};

export const supabaseBankDetailsRepository: BankDetailsRepository = {
  async getMine(actor) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return failure({ message: "Supabase is not configured." });
    const query = actor.role === "agent"
      ? supabase.from("agent_payment_details").select("bank_name,account_holder_name,account_number").eq("agent_id", actor.agentId).maybeSingle()
      : supabase.from("profile_bank_details").select("bank_name,account_holder_name,account_number").eq("profile_id", actor.id).maybeSingle();
    const { data, error } = await query;
    if (error) return failure(error);
    return { ok: true, data: data ? { bankName: data.bank_name, accountHolderName: data.account_holder_name, accountNumber: data.account_number } : null };
  },
  async updateMine(actor, input) {
    const fieldErrors = validate(input);
    if (Object.keys(fieldErrors).length) return failure<BankDetails>({ message: "Check the highlighted bank details and try again." }, fieldErrors);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return failure<BankDetails>({ message: "Supabase is not configured." });
    const bankName = input.bankName.trim();
    const accountHolderName = input.accountHolderName.trim();
    const accountNumber = input.accountNumber.trim();
    const { data, error } = actor.role === "agent"
      ? await supabase.rpc("upsert_agent_payment_details", { p_agent_id: actor.agentId, p_bank_name: bankName, p_account_holder_name: accountHolderName, p_account_number: accountNumber, p_mark_verified: false })
      : await supabase.rpc("upsert_profile_bank_details", { p_profile_id: actor.id, p_bank_name: bankName, p_account_holder_name: accountHolderName, p_account_number: accountNumber });
    if (error) return failure<BankDetails>(error);
    const saved = data as { bank_name?: string; account_holder_name?: string; account_number?: string } | null;
    return { ok: true, data: { bankName: saved?.bank_name ?? bankName, accountHolderName: saved?.account_holder_name ?? accountHolderName, accountNumber: saved?.account_number ?? accountNumber } };
  },
};

export const bankDetailsRepository: BankDetailsRepository = isSupabaseConfigured() ? supabaseBankDetailsRepository : mockBankDetailsRepository;

export function resetMockBankDetails() {
  mockDetails = structuredClone(mockBankDetails);
}
