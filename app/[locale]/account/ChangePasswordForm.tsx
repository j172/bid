"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/app/components/Button";
import PasswordStrengthMeter from "@/app/components/PasswordStrengthMeter";
import { inputClass } from "@/lib/formStyles";
import { usePostJson } from "@/lib/usePostJson";

interface ChangePasswordFormProps {
  initialHasPassword?: boolean;
}

export default function ChangePasswordForm({ initialHasPassword = true }: ChangePasswordFormProps) {
  const t = useTranslations("changePasswordForm");
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { post, submitting, error } = usePostJson(t("defaultError"));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);

    const payload = hasPassword ? { oldPassword, newPassword } : { newPassword };
    const data = await post("/api/account/change-password", payload);
    if (!data) return;

    setOldPassword("");
    setNewPassword("");
    const wasPasswordless = !hasPassword;
    setHasPassword(true);
    setNotice(wasPasswordless ? t("setSaved") : t("saved"));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {hasPassword && (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
          {t("oldPassword")}
          <input
            type="password"
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className={inputClass}
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("newPassword")}
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
        <PasswordStrengthMeter password={newPassword} />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? t("submitting") : hasPassword ? t("submit") : t("setSubmit")}
        </Button>
        {error && <span className="text-sm text-ended">{error}</span>}
        {notice && <span className="text-sm text-leading">{notice}</span>}
      </div>
    </form>
  );
}
