import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, getUserDetail } from "@/lib/auth";
import { getBidHistoryForUser, getListingsCreatedByUser } from "@/lib/listings";
import { formatAdminDateTime } from "@/lib/format";
import StatusBadge from "../../../components/StatusBadge";
import RoleToggleButton from "../RoleToggleButton";
import SuspendToggleButton from "../SuspendToggleButton";
import ResetPasswordButton from "../ResetPasswordButton";
import DisableTwoFactorButton from "../DisableTwoFactorButton";
import AdminPageIntro from "../../AdminPageIntro";
import { AdminTable, AdminTableCell, AdminTableRow } from "../../components/AdminTable";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { active: "正常", suspended: "停權", deleted: "已刪除" };
// issue #97 adds 'totp' alongside #93's 'email_otp' — both non-'none' values
// share the same DisableTwoFactorButton rescue path below, but the detail
// label needs to say which one is actually active.
const TWO_FACTOR_LABEL: Record<string, string> = { none: "未啟用", email_otp: "Email 驗證碼", totp: "App 驗證碼（TOTP）" };

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
      <AdminPageIntro title={detail.displayName ?? detail.email} description="檢視使用者資料、權限與出價行為明細。">
        <Link href="/z04urru6/users" className="text-sm text-interactive-primary hover:underline">
          ← 回使用者列表
        </Link>
      </AdminPageIntro>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
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
            <dt className="text-ink-light">兩階段驗證</dt>
            <dd>{TWO_FACTOR_LABEL[detail.twoFactorMethod] ?? "未啟用"}</dd>
            <dt className="text-ink-light">註冊時間</dt>
            <dd>{formatAdminDateTime(detail.createdAt)}</dd>
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
              <ResetPasswordButton userId={detail.id} email={detail.email} />
              {detail.twoFactorMethod !== "none" && (
                <DisableTwoFactorButton userId={detail.id} email={detail.email} />
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold">上架紀錄</h2>
          {listings.length === 0 ? (
            <p className="mt-4 text-sm text-ink-light">這個帳號從未上架過商品。</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {listings.map((listing) => (
                <li key={listing.id} className="flex items-center justify-between text-sm">
                  <Link href={`/listings/${listing.id}`} className="font-medium text-interactive-primary hover:underline">
                    {listing.title}
                  </Link>
                  <StatusBadge status={listing.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">出價紀錄</h2>
        {bids.length === 0 ? (
          <p className="mt-4 text-sm text-ink-light">這個帳號從未出過價。</p>
        ) : (
          <AdminTable
            headers={["商品", "出價金額", "出價時間", "目前價格", "狀態"]}
            wrapperClassName="mt-4 overflow-x-auto"
          >
            {bids.map((bid, index) => (
              <AdminTableRow key={index}>
                <AdminTableCell>
                  <Link href={`/listings/${bid.listingId}`} className="font-medium text-interactive-primary hover:underline">
                    {bid.listingTitle}
                  </Link>
                </AdminTableCell>
                <AdminTableCell>{bid.bidAmount}</AdminTableCell>
                <AdminTableCell>{formatAdminDateTime(bid.bidAt)}</AdminTableCell>
                <AdminTableCell className="font-semibold">{bid.listingCurrentPrice}</AdminTableCell>
                <AdminTableCell>
                  <StatusBadge status={bid.listingStatus} isLeading={bid.isLeading} />
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTable>
        )}
      </div>
    </main>
  );
}
