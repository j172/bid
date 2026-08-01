"use client";

import type { FormEvent, ReactNode } from "react";
import Button from "@/app/components/Button";

interface AuthFormShellProps {
  title: string;
  onSubmit: (event: FormEvent) => void;
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  error?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthFormShell({
  title,
  onSubmit,
  submitting,
  submitLabel,
  submittingLabel,
  error,
  children,
  footer,
}: AuthFormShellProps) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-bold">{title}</h1>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {children}
          {error && <p className="text-sm text-ended">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? submittingLabel : submitLabel}
          </Button>
        </form>
        {footer}
      </div>
    </main>
  );
}