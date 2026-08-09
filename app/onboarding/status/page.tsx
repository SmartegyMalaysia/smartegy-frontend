import { RegistrationStatusPage } from "@/components/onboarding-pages";
import { Suspense } from "react";

export default function StatusPage() { return <Suspense fallback={null}><RegistrationStatusPage /></Suspense>; }
