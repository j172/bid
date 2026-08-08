"use client";

// Password strength meter backed by zxcvbn. Deliberately generic (accepts a
// bare `password` string) so it can be dropped into any password field —
// used on the register page (issue #101) and reused as-is on the account
// change-password page (issue #102).

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import zxcvbn from "zxcvbn";

interface PasswordStrengthMeterProps {
  password: string;
}

type StrengthKey = "weak" | "medium" | "strong";

interface StrengthLevel {
  key: StrengthKey;
  barClass: string;
  textClass: string;
}

const LEVELS: StrengthLevel[] = [
  { key: "weak", barClass: "bg-ended", textClass: "text-ended" },
  { key: "weak", barClass: "bg-ended", textClass: "text-ended" },
  { key: "medium", barClass: "bg-amber-500", textClass: "text-amber-600" },
  { key: "strong", barClass: "bg-leading", textClass: "text-leading" },
  { key: "strong", barClass: "bg-leading", textClass: "text-leading" },
];

export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const t = useTranslations("passwordStrength");
  const score: number = useMemo(() => (password ? zxcvbn(password).score : -1), [password]);

  if (!password || score < 0) {
    return null;
  }

  const level = LEVELS[score] ?? LEVELS[0]!;

  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <div className="flex gap-1" role="img" aria-label={t(level.key)}>
        {LEVELS.map((_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${index <= score ? level.barClass : "bg-border"}`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${level.textClass}`}>{t(level.key)}</p>
    </div>
  );
}
