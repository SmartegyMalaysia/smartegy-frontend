import { RegistrationReviewPage } from "@/components/registration-review";

export default async function RegistrationDetailPage({ params }: { params: { applicationNumber: string } }) {
  return <RegistrationReviewPage applicationNumber={decodeURIComponent(params.applicationNumber)} />;
}
