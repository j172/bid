import { getOverviewStats } from "@/lib/listings";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const stats = await getOverviewStats();

  const cards = [
    { label: "開放中商品", value: stats.openCount },
    { label: "已結標商品", value: stats.closedCount },
    { label: "使用者總數", value: stats.userCount },
    { label: "總成交額", value: stats.totalGmv },
  ];

  return (
    <main>
      <h1 className="text-2xl font-bold">後台總覽</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <p className="text-sm text-ink-light">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-gold">{card.value}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
