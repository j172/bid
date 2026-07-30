import { redirect } from "next/navigation";
import { getAccountProfile, getCurrentUser } from "@/lib/auth";
import ChangePasswordForm from "./ChangePasswordForm";
import DeleteAccountButton from "./DeleteAccountButton";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getAccountProfile(user.id);

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">帳戶設定</h1>

      <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">個人資料</h2>
        <div className="mt-4">
          <ProfileForm
            initialDisplayName={profile?.displayName ?? ""}
            initialPhone={profile?.phone ?? ""}
            initialAddress={profile?.address ?? ""}
          />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">修改密碼</h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-ended/30 bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ended">刪除帳戶</h2>
        <p className="mt-2 text-sm text-ink-light">
          若你目前正在領先任何開放中的商品，或有已得標但尚未由管理員標記完成交易的商品，將無法刪除帳戶。
        </p>
        <div className="mt-4">
          <DeleteAccountButton />
        </div>
      </section>
    </main>
  );
}
