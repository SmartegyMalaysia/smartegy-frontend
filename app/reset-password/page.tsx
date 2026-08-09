import { Suspense } from "react";
import { ResetPasswordPage } from "@/components/auth-pages";

export default function ResetPasswordRoute() { return <Suspense fallback={null}><ResetPasswordPage/></Suspense>; }
