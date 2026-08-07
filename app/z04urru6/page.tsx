import { getOverviewStats } from "@/lib/listings";
import {
  getDailyGmvTrend,
  getDailyNewUserTrend,
  getGmvSplitByType,
  getPendingActionItems,
  getRecentActivity,
  getTopBiddersByCount,
  getTopCustomersBySpend,
  getTopListingsByGmv,
} from "@/lib/dashboard";
import { getAllLatestStoredRates } from "@/lib/exchangeRates";
import { GmvSplitBar, GmvTrendChart, NewUserTrendChart } from "./DashboardCharts";
import PendingActions from "./PendingActions";
import Leaderboards from "./Leaderboards";
import RecentActivity from "./RecentActivity";
import AdminPageIntro from "./AdminPageIntro";
import ExchangeRateSyncPanel from "./ExchangeRateSyncPanel";

export const dynamic = "force-dynamic";

const cardClass = "rounded-2xl border border-border bg-surface p-5 shadow-sm";

export default async function AdminOverviewPage() {
  const [
    stats,
    gmvTrend,
    userTrend,
    gmvSplit,
    pendingItems,
    topListings,
    topBidders,
    topCustomers,
    activity,
    exchangeRates,
  ] = await Promise.all([
    getOverviewStats(),
    getDailyGmvTrend(),
    getDailyNewUserTrend(),
    getGmvSplitByType(),
    getPendingActionItems(),
    getTopListingsByGmv(),
    getTopBiddersByCount(),
    getTopCustomersBySpend(),
    getRecentActivity(),
    getAllLatestStoredRates(),
  ]);

  const cards = [
    { label: "開放中商品", value: stats.openCount },
    { label: "已結標商品", value: stats.closedCount },
    { label: "使用者總數", value: stats.userCount },
    { label: "總成交額", value: stats.totalGmv },
  ];

  return (
    <main className="flex flex-col gap-8">
      <div>
        <AdminPageIntro title="後台總覽" description="即時掌握商品、會員與成交狀況。" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className={cardClass}>
              <p className="text-sm text-ink-light">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-interactive-primary">{card.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">待處理事項</h2>
        <div className="mt-3">
          <PendingActions items={pendingItems} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className="text-lg font-semibold">每日成交額趨勢（最近 30 天）</h2>
          <div className="mt-2">
            <GmvTrendChart data={gmvTrend} />
          </div>
        </div>
        <div className={cardClass}>
          <h2 className="text-lg font-semibold">每日新增使用者趨勢（最近 30 天）</h2>
          <div className="mt-2">
            <NewUserTrendChart data={userTrend} />
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <h2 className="text-lg font-semibold">競標 vs 一般商品成交額比例</h2>
        <div className="mt-4">
          <GmvSplitBar auctionGmv={gmvSplit.auctionGmv} fixedPriceGmv={gmvSplit.fixedPriceGmv} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">排行榜</h2>
        <div className="mt-3">
          <Leaderboards topListings={topListings} topBidders={topBidders} topCustomers={topCustomers} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">最近活動</h2>
        <div className="mt-3">
          <RecentActivity activity={activity} />
        </div>
      </div>

      <ExchangeRateSyncPanel initialRates={exchangeRates} />
    </main>
  );
}
