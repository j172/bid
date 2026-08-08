"use client";

import { useTranslations } from "next-intl";
import zxcvbn from "zxcvbn";

/**
 * zxcvbn scores are 0-4; we collapse that into the three buckets we show the
 * user (weak/medium/strong). Shared by the register page and the account
 * change-password form so both give the same feedback for the same password.
 */
const LEVELS = [
  { key: "weak", barClassName: "bg-ended", textClassName: "text-ended" },
  { key: "weak", barClassName: "bg-ended", textClassName: "text-ended" },
  { key: "medium", barClassName: "bg-amber-500", textClassName: "text-amber-600" },
  { key: "strong", barClassName: "bg-leading", textClassName: "text-leading" },
  { key: "strong", barClassName: "bg-leading", textClassName: "text-leading" },
] as const;

export default function PasswordStrengthMeter({ password }: { password: string }) {
  const t = useTranslations("passwordStrengthMeter");

  if (!password) {
    return null;
  }

  const { score } = zxcvbn(password);
  const level = LEVELS[score];

  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <div className="flex gap-1" role="presentation">
        {LEVELS.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 flex-1 rounded-full ${index <= score ? level.barClassName : "bg-border"}`}
          />
        ))}
      </div>
      <span className={`text-xs font-medium ${level.textClassName}`}>{t(level.key)}</span>
    </div>
  );
}
