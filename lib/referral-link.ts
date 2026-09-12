export function resolveReferralCode(code: string): string {
  return decodeURIComponent(code);
}

export function referralCodeForSubmission(
  fieldValue: string,
  confirmedCode?: string | null,
): string {
  return (confirmedCode ?? fieldValue).trim();
}
