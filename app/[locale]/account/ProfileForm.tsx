"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/app/components/Button";
import { useRouter } from "@/i18n/navigation";
import { inputClass } from "@/lib/formStyles";
import { usePostJson } from "@/lib/usePostJson";

export default function ProfileForm({
  initialDisplayName,
  initialPhone,
  initialAddress,
}: {
  initialDisplayName: string;
  initialPhone: string;
  initialAddress: string;
}) {
  const router = useRouter();
  const t = useTranslations("profileForm");
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress);
  const [notice, setNotice] = useState<string | null>(null);
  const { post, submitting, error } = usePostJson(t("defaultError"));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);

    const data = await post("/api/account/profile", { displayName, phone, address });
    if (!data) return;

    setNotice(t("saved"));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("displayName")}
        <input
          type="text"
          required
          maxLength={50}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("phone")}
        <input
          type="tel"
          required
          maxLength={20}
          pattern="[0-9\- ]{7,20}"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        {t("address")}
        <input
          type="text"
          required
          maxLength={200}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? t("saving") : t("save")}
        </Button>
        {error && <span className="text-sm text-ended">{error}</span>}
        {notice && <span className="text-sm text-leading">{notice}</span>}
      </div>
    </form>
  );
}
