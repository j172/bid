import { getLocale, getTranslations } from "next-intl/server";
import { getAccountProfile, getCurrentUser } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import ChangePasswordForm from "./ChangePasswordForm";
import DeleteAccountButton from "./DeleteAccountButton";
import ProfileForm from "./ProfileForm";
import TwoFactorSection from "./TwoFactorSection";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    return redirect({ href: "/login", locale: await getLocale() });
  }

  const profile = await getAccountProfile(user.id);
  const t = await getTranslations("account");

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("profileTitle")}</h2>
        <div className="mt-4">
          <ProfileForm
            initialDisplayName={profile?.displayName ?? ""}
            initialPhone={profile?.phone ?? ""}
            initialAddress={profile?.address ?? ""}
          />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("passwordTitle")}</h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("twoFactorTitle")}</h2>
        <p className="mt-2 text-sm text-ink-light">{t("twoFactorDescription")}</p>
        <div className="mt-4">
          <TwoFactorSection initialEnabled={profile?.twoFactorMethod === "email_otp"} />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-ended/30 bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ended">{t("deleteTitle")}</h2>
        <p className="mt-2 text-sm text-ink-light">{t("deleteWarning")}</p>
        <div className="mt-4">
          <DeleteAccountButton />
        </div>
      </section>
    </main>
  );
}
