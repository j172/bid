"use client";

import { useState } from "react";
import RichTextContent from "../../../components/RichTextContent";

type TabKey = "description" | "additional" | "activity";

interface ActivityLine {
  maskedName: string;
  amountLabel: string;
  dateLabel: string;
}

interface ListingDetailTabsProps {
  descriptionLabel: string;
  additionalLabel: string;
  activityLabel: string;
  descriptionTitle: string;
  additionalTitle: string;
  activityTitle: string;
  description: string;
  specs: Array<{ label: string; value: string }>;
  /** Pre-formatted total bid/purchase count sentence — shown once, not per-row (see issue #45). */
  activityTotalCountLabel: string;
  /** Newest-first, already capped to the most recent 20 by getListingActivityFeed. */
  activityLines: ActivityLine[];
  activityEmptyLabel: string;
}

export default function ListingDetailTabs({
  descriptionLabel,
  additionalLabel,
  activityLabel,
  descriptionTitle,
  additionalTitle,
  activityTitle,
  description,
  specs,
  activityTotalCountLabel,
  activityLines,
  activityEmptyLabel,
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
              ? "bg-interactive-primary text-white"
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
              ? "bg-interactive-primary text-white"
              : "bg-slate-100 text-ink-light hover:bg-slate-200"
          }`}
        >
          {additionalLabel}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("activity")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "activity"
              ? "bg-interactive-primary text-white"
              : "bg-slate-100 text-ink-light hover:bg-slate-200"
          }`}
        >
          {activityLabel}
        </button>
      </div>

      {activeTab === "description" && (
        <div className="pt-6">
          <h3 className="text-xl font-black text-ink">{descriptionTitle}</h3>
          <RichTextContent html={description} className="mt-3 leading-7 text-ink-light" />
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

      {activeTab === "activity" && (
        <div className="pt-6">
          <h3 className="text-xl font-black text-ink">{activityTitle}</h3>
          <p className="mt-2 text-sm font-semibold text-ink-light">{activityTotalCountLabel}</p>
          {activityLines.length === 0 ? (
            <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink-light">
              {activityEmptyLabel}
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {activityLines.map((line) => (
                <div
                  key={`${line.dateLabel}-${line.maskedName}-${line.amountLabel}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
                >
                  <span className="font-semibold text-ink">{line.maskedName}</span>
                  <span className="font-bold text-interactive-primary">{line.amountLabel}</span>
                  <span className="text-xs text-ink-light">{line.dateLabel}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
