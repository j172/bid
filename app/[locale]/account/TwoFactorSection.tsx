"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/app/components/Button";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";

// USER ACCOUNT's Email OTP on/off toggle (issue #93). Both directions
// require re-entering the current password — see lib/auth.ts's
// setTwoFactorMethod header comment — so clicking the toggle never submits
// immediately; it opens an inline password-confirmation form first, mirroring
// ChangePasswordForm's oldPassword requirement rather than DeleteAccountButton's
// plain window.confirm() (a confirm() dialog can't collect a password).
export default function TwoFactorSection({ initialEnabled }: { initialEnabled: boolean }) {
  const t = useTranslations("twoFactorSection");
  const tErrors = useTranslations("errors");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openConfirm() {
    setShowConfirm(true);
    setError(null);
    setNotice(null);
    setCurrentPassword("");
  }

  function cancelConfirm() {
    setShowConfirm(false);
    setCurrentPassword("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const nextEnabled = !enabled;
    const response = await fetch("/api/account/two-factor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, enabled: nextEnabled }),
    });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.errorCode ? tErrors(data.errorCode) : t("defaultError"));
      return;
    }
    setEnabled(nextEnabled);
    setShowConfirm(false);
    setCurrentPassword("");
    setNotice(nextEnabled ? t("enabledNotice") : t("disabledNotice"));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-light">
        {t("statusLabel")}
        {"："}
        <span className={enabled ? "font-medium text-leading" : "font-medium text-ink-light"}>
          {enabled ? t("statusEnabled") : t("statusDisabled")}
        </span>
      </p>

      {!showConfirm ? (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={openConfirm}>
            {enabled ? t("disableButton") : t("enableButton")}
          </Button>
          {notice && <span className="text-sm text-leading">{notice}</span>}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-ink-light">{enabled ? t("disableConfirmPrompt") : t("enableConfirmPrompt")}</p>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            {t("currentPasswordLabel")}
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? t("submitting") : t("confirmSubmit")}
            </Button>
            <button type="button" onClick={cancelConfirm} className="text-sm text-ink-light hover:underline">
              {t("cancel")}
            </button>
            {error && <span className="text-sm text-ended">{error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
