import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

// ResetPasswordForm reads ?token= via next/navigation's useSearchParams,
// which requires a Suspense boundary around it (Next.js App Router opts the
// whole route into client-only rendering for that segment otherwise) — see
// app/[locale]/components/WebVitalsReporter.tsx for the only other
// useSearchParams user in this codebase, which gets away without one only
// because it's rendered outside any statically-generated page.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
