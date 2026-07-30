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
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
      <h1>建立商品</h1>
      <NewListingForm />
    </main>
  );
}
