import type { ReactNode } from "react";

export default function AdminPageIntro({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description ? <p className="mt-2 text-sm text-ink-light">{description}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}