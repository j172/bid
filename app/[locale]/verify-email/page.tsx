import { Suspense } from "react";
import VerifyEmailForm from "./VerifyEmailForm";

// VerifyEmailForm reads ?token= via next/navigation's useSearchParams, which
// requires a Suspense boundary around it — same reason and same split as
// app/[locale]/reset-password/page.tsx/ResetPasswordForm.tsx.
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
