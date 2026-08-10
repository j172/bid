"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/app/components/Button";
import { inputClass } from "@/lib/formStyles";
import { usePostJson } from "@/lib/usePostJson";

type Step = "idle" | "qr" | "backupCodes" | "disableConfirm";

// USER ACCOUNT's TOTP ("App 驗證碼") setup wizard (issue #97) — sits
// alongside TwoFactorSection (#93's Email OTP toggle) on the account page;
// both write the same mutually-exclusive users.two_factor_method column, so
// turning this on implicitly turns Email OTP off (and vice versa) with no
// extra UI needed here — see lib/totp.ts's confirmTotpSetup.
//
// Unlike TwoFactorSection's single password-confirm step, enabling TOTP is a
// multi-step round trip: request a secret (POST .../setup, no password
// needed yet — nothing has changed server-side) → scan the QR code (or type
// the secret manually) into an Authenticator app → confirm with the app's
// 6-digit code *and* the current password (POST .../confirm — this is the
// step that actually flips two_factor_method, mirroring TwoFactorSection's
// password requirement) → the confirm response carries 10 one-time backup
// codes, shown here exactly once and never retrievable again. Disabling is a
// single password-confirm step, same shape as TwoFactorSection's.
export default function TotpSection({ initialActive }: { initialActive: boolean }) {
  const t = useTranslations("totpSection");
  const [active, setActive] = useState(initialActive);
  const [step, setStep] = useState<Step>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  // One hook instance for all three round trips (setup / confirm / disable):
  // they are mutually exclusive `step`s, so a single in-flight flag and a
  // single error slot cover them exactly as the three separate flags this
  // component used to keep did (issue #139 item 1).
  const { post, submitting, error, setError } = usePostJson(t("defaultError"));

  const [setupToken, setSetupToken] = useState("");
  const [secret, setSecret] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [disablePassword, setDisablePassword] = useState("");

  async function handleStartSetup() {
    setNotice(null);

    const data = await post<{ ok?: boolean; token: string; secret: string; qrCodeDataUrl: string }>(
      "/api/account/totp/setup",
    );
    if (!data) return;

    setSetupToken(data.token);
    setSecret(data.secret);
    setQrCodeDataUrl(data.qrCodeDataUrl);
    setCode("");
    setConfirmPassword("");
    setStep("qr");
  }

  function cancelSetup() {
    setStep("idle");
    setSetupToken("");
    setSecret("");
    setQrCodeDataUrl("");
    setCode("");
    setConfirmPassword("");
    setError(null);
  }

  async function handleConfirmSubmit(event: React.FormEvent) {
    event.preventDefault();

    const data = await post<{ ok?: boolean; backupCodes: string[] }>("/api/account/totp/confirm", {
      token: setupToken,
      code,
      currentPassword: confirmPassword,
    });
    if (!data) return;

    setBackupCodes(data.backupCodes);
    setStep("backupCodes");
    setActive(true);
  }

  function finishBackupCodes() {
    setStep("idle");
    setBackupCodes([]);
    setSetupToken("");
    setSecret("");
    setQrCodeDataUrl("");
    setCode("");
    setConfirmPassword("");
    setNotice(t("enabledNotice"));
  }

  function openDisableConfirm() {
    setStep("disableConfirm");
    setDisablePassword("");
    setError(null);
    setNotice(null);
  }

  function cancelDisableConfirm() {
    setStep("idle");
    setDisablePassword("");
    setError(null);
  }

  async function handleDisableSubmit(event: React.FormEvent) {
    event.preventDefault();

    const data = await post("/api/account/totp/disable", { currentPassword: disablePassword });
    if (!data) return;

    setActive(false);
    setStep("idle");
    setDisablePassword("");
    setNotice(t("disabledNotice"));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-light">
        {t("statusLabel")}
        {"："}
        <span className={active ? "font-medium text-leading" : "font-medium text-ink-light"}>
          {active ? t("statusEnabled") : t("statusDisabled")}
        </span>
      </p>

      {step === "idle" && (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={active ? openDisableConfirm : handleStartSetup} disabled={submitting}>
            {submitting ? t("starting") : active ? t("disableButton") : t("enableButton")}
          </Button>
          {notice && <span className="text-sm text-leading">{notice}</span>}
          {error && <span className="text-sm text-ended">{error}</span>}
        </div>
      )}

      {step === "qr" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-light">{t("scanPrompt")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not a static/remote asset Next's <Image> can optimize */}
          <img src={qrCodeDataUrl} alt={t("qrAlt")} className="h-48 w-48 self-start rounded-md border border-border" />
          <div>
            <p className="text-xs text-ink-light">{t("manualEntryLabel")}</p>
            <p className="select-all break-all rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-sm">
              {secret}
            </p>
          </div>
          <form onSubmit={handleConfirmSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              {t("codeLabel")}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              {t("currentPasswordLabel")}
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? t("submitting") : t("confirmSubmit")}
              </Button>
              <button type="button" onClick={cancelSetup} className="text-sm text-ink-light hover:underline">
                {t("cancel")}
              </button>
              {error && <span className="text-sm text-ended">{error}</span>}
            </div>
          </form>
        </div>
      )}

      {step === "backupCodes" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-ended">{t("backupCodesWarning")}</p>
          <ul className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-muted p-4 font-mono text-sm">
            {backupCodes.map((backupCode) => (
              <li key={backupCode}>{backupCode}</li>
            ))}
          </ul>
          <div>
            <Button type="button" onClick={finishBackupCodes}>
              {t("backupCodesDone")}
            </Button>
          </div>
        </div>
      )}

      {step === "disableConfirm" && (
        <form onSubmit={handleDisableSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-ink-light">{t("disableConfirmPrompt")}</p>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            {t("currentPasswordLabel")}
            <input
              type="password"
              required
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? t("submitting") : t("confirmSubmit")}
            </Button>
            <button type="button" onClick={cancelDisableConfirm} className="text-sm text-ink-light hover:underline">
              {t("cancel")}
            </button>
            {error && <span className="text-sm text-ended">{error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
