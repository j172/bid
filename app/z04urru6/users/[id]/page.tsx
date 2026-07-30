import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, getUserDetail } from "@/lib/auth";
import { getBidHistoryForUser, getListingsCreatedByUser } from "@/lib/listings";
import StatusBadge from "../../../components/StatusBadge";
import RoleToggleButton from "../RoleToggleButton";
import SuspendToggleButton from "../SuspendToggleButton";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

const STATUS_LABEL: Record<string, string> = { active: "正常", suspended: "停權", deleted: "已刪除" };

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("zh-TW", { hour12: false });
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) {
    notFound();
  }

  const detail = await getUserDetail(userId);
  if (!detail) {
    notFound();
  }

  const currentUser = await getCurrentUser();
  const [bids, listings] = await Promise.all([getBidHistoryForUser(userId), getListingsCreatedByUser(userId)]);

  return (
    <main>
      <Link href="/z04urru6/users" className="text-sm text-gold hover:underline">
        ← 回使用者列表
      </Link>

      <h1 className="mt-3 text-2xl font-bold">{detail.displayName ?? detail.email}</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold">個人資料</h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-light">Email</dt>
            <dd>{detail.email}</dd>
            <dt className="text-ink-light">顯示名稱</dt>
            <dd>{detail.displayName ?? "—"}</dd>
            <dt className="text-ink-light">電話</dt>
            <dd>{detail.phone ?? "—"}</dd>
            <dt className="text-ink-light">地址</dt>
            <dd>{detail.address ?? "—"}</dd>
            <dt className="text-ink-light">角色</dt>
            <dd>{detail.role === "admin" ? "管理員" : "一般使用者"}</dd>
            <dt className="text-ink-light">帳號狀態</dt>
            <dd>{STATUS_LABEL[detail.status]}</dd>
            <dt className="text-ink-light">註冊時間</dt>
            <dd>{formatDate(detail.createdAt)}</dd>
          </dl>

          {detail.status === "deleted" ? (
            <p className="mt-6 text-sm text-ink-light">此帳號已刪除（匿名化），無法進行操作。</p>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-4">
              <RoleToggleButton userId={detail.id} currentRole={detail.role} isSelf={detail.id === currentUser?.id} />
              <SuspendToggleButton
                userId={detail.id}
                isSuspended={detail.status === "suspended"}
                isSelf={detail.id === currentUser?.id}
              />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold">上架紀錄</h2>
          {listings.length === 0 ? (
            <p className="mt-4 text-sm text-ink-light">這個帳號從未上架過商品。</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {listings.map((listing) => (
                <li key={listing.id} className="flex items-center justify-between text-sm">
                  <Link href={`/listings/${listing.id}`} className="font-medium text-gold hover:underline">
                    {listing.title}
                  </Link>
                  <StatusBadge status={listing.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">出價紀錄</h2>
        {bids.length === 0 ? (
          <p className="mt-4 text-sm text-ink-light">這個帳號從未出過價。</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>商品</th>
                  <th className={th}>出價金額</th>
                  <th className={th}>出價時間</th>
                  <th className={th}>目前價格</th>
                  <th className={th}>狀態</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((bid, index) => (
                  <tr key={index}>
                    <td className={td}>
                      <Link href={`/listings/${bid.listingId}`} className="font-medium text-gold hover:underline">
                        {bid.listingTitle}
                      </Link>
                    </td>
                    <td className={td}>{bid.bidAmount}</td>
                    <td className={td}>{formatDate(bid.bidAt)}</td>
                    <td className={`${td} font-semibold`}>{bid.listingCurrentPrice}</td>
                    <td className={td}>
                      <StatusBadge status={bid.listingStatus} isLeading={bid.isLeading} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
