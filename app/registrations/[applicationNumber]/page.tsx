import { RegistrationReviewPage } from "@/components/registration-review";

export default async function RegistrationDetailPage({ params }: { params: Promise<{ applicationNumber: string }> }) {
  const { applicationNumber } = await params;
  return <RegistrationReviewPage applicationNumber={decodeURIComponent(applicationNumber)} />;
}
