import { RegistrationSignup } from "@/components/registration-signup";
import { resolveReferralCode } from "@/lib/referral-link";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RegistrationSignup referralCode={resolveReferralCode(code)} />;
}
