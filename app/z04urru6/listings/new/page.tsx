import NewListingForm from "./NewListingForm";
import AdminPageIntro from "../../AdminPageIntro";

export default function NewListingPage() {
  return (
    <main>
      <AdminPageIntro title="建立商品" description="快速建立競標或一般商品，內容會立即進入上架流程。" />
      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <NewListingForm />
      </div>
    </main>
  );
}
