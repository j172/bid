import NewListingForm from "./NewListingForm";

export default function NewListingPage() {
  return (
    <main>
      <h1 className="text-2xl font-bold">建立商品</h1>
      <div className="mt-6 max-w-xl rounded-lg border border-border bg-surface p-6 shadow-sm">
        <NewListingForm />
      </div>
    </main>
  );
}
