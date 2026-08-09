import { RegistrationSignup } from "@/components/registration-signup";

export default function JoinPage({ params }: { params: { code: string } }) {
  return <RegistrationSignup referralCode={params.code} />;
}
