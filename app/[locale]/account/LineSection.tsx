"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePostJson } from "@/lib/usePostJson";

interface LineSectionProps {
  initialLineLinked: boolean;
}

export default function LineSection({ initialLineLinked }: LineSectionProps) {
  const t = useTranslations("account");
  const [lineLinked, setLineLinked] = useState(initialLineLinked);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const { post, submitting, error } = usePostJson(t("defaultError"));

  async function handleUnlink() {
    const res = await post("/api/auth/line/unlink", {});
    if (res && res.ok) {
      setLineLinked(false);
      setConfirmUnlink(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {lineLinked ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                {t("lineLinkedBadge")}
              </span>
              <span className="text-sm text-ink-light">{t("lineLinkedDescription")}</span>
            </div>
          </div>

          {confirmUnlink ? (
            <div className="rounded-md border border-border bg-surface-muted p-4">
              <p className="text-sm text-ink">{t("unlinkConfirmPrompt")}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={submitting}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? t("unlinkingSubmitting") : t("confirmUnlinkButton")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmUnlink(false)}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
                >
                  {t("cancelButton")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setConfirmUnlink(true)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                {t("unlinkLineButton")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-light">{t("lineUnlinkedDescription")}</p>
          <div>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/auth/line?returnTo=/account"
              className="inline-flex items-center gap-2 rounded-md bg-[#06C755] px-4 py-2 text-sm font-bold text-white hover:bg-[#05B04B]"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C6.48 2 2 5.82 2 10.53c0 2.92 1.74 5.51 4.41 7.06-.19.67-.68 2.45-.78 2.82-.12.46.17.45.36.33.15-.1 2.05-1.39 2.88-1.95.36.05.73.08 1.13.08 5.52 0 10-3.82 10-8.53C20 5.82 17.52 2 12 2zm-4.7 10.96H5.43c-.22 0-.4-.18-.4-.4V7.5c0-.22.18-.4.4-.4h1.87c.22 0 .4.18.4.4v.67c0 .22-.18.4-.4.4H6.37v1.17h.93c.22 0 .4.18.4.4v.67c0 .22-.18.4-.4.4h-.93v1.23h.93c.22 0 .4.18.4.4v.67c0 .22-.18.35-.4.35zm3.07 0h-.94c-.22 0-.4-.18-.4-.4V7.5c0-.22.18-.4.4-.4h.94c.22 0 .4.18.4.4v5.06c0 .22-.18.4-.4.4zm4.18 0h-.87c-.16 0-.3-.09-.36-.23L11.75 9.8v2.76c0 .22-.18.4-.4.4h-.94c-.22 0-.4-.18-.4-.4V7.5c0-.22.18-.4.4-.4h.87c.16 0 .3.09.36.23l1.57 2.93V7.5c0-.22.18-.4.4-.4h.94c.22 0 .4.18.4.4v5.06c0 .22-.18.4-.4.4zm3.85-3.32h-.93v1.19h.93c.22 0 .4.18.4.4v.67c0 .22-.18.4-.4.4h-1.87c-.22 0-.4-.18-.4-.4V7.5c0-.22.18-.4.4-.4h1.87c.22 0 .4.18.4.4v.67c0 .22-.18.4-.4.4h-.93v1.17h.93c.22 0 .4.18.4.4v.67c0 .22-.18.4-.4.4z" />
              </svg>
              <span>{t("linkLineButton")}</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
