"use client";

import { useState } from "react";

type TabKey = "description" | "additional" | "reviews";

interface ListingDetailTabsProps {
  descriptionLabel: string;
  additionalLabel: string;
  reviewsLabel: string;
  descriptionTitle: string;
  additionalTitle: string;
  reviewsTitle: string;
  description: string;
  specs: Array<{ label: string; value: string }>;
  reviewLines: string[];
}

export default function ListingDetailTabs({
  descriptionLabel,
  additionalLabel,
  reviewsLabel,
  descriptionTitle,
  additionalTitle,
  reviewsTitle,
  description,
  specs,
  reviewLines,
}: ListingDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("description");

  return (
    <section className="mt-12 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        <button
          type="button"
          onClick={() => setActiveTab("description")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "description"
              ? "bg-brand-blue text-white"
              : "bg-slate-100 text-ink-light hover:bg-slate-200"
          }`}
        >
          {descriptionLabel}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("additional")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "additional"
              ? "bg-brand-blue text-white"
              : "bg-slate-100 text-ink-light hover:bg-slate-200"
          }`}
        >
          {additionalLabel}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reviews")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "reviews"
              ? "bg-brand-blue text-white"
              : "bg-slate-100 text-ink-light hover:bg-slate-200"
          }`}
        >
          {reviewsLabel}
        </button>
      </div>

      {activeTab === "description" && (
        <div className="pt-6">
          <h3 className="text-xl font-black text-ink">{descriptionTitle}</h3>
          <p className="mt-3 whitespace-pre-wrap leading-7 text-ink-light">{description}</p>
        </div>
      )}

      {activeTab === "additional" && (
        <div className="pt-6">
          <h3 className="text-xl font-black text-ink">{additionalTitle}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {specs.map((spec) => (
              <div key={spec.label} className="rounded-lg border border-border bg-surface px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">{spec.label}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{spec.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "reviews" && (
        <div className="pt-6">
          <h3 className="text-xl font-black text-ink">{reviewsTitle}</h3>
          <div className="mt-4 space-y-3">
            {reviewLines.map((line) => (
              <p key={line} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink-light">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
