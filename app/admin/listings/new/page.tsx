import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import NewListingForm from "./NewListingForm";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">建立商品</h1>
      <div className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <NewListingForm />
      </div>
    </main>
  );
}
