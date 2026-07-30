import Link from "next/link";
import { getCurrentUser, listUsers, USERS_PAGE_SIZE, type ListUsersOptions } from "@/lib/auth";
import RoleToggleButton from "./RoleToggleButton";
import SuspendToggleButton from "./SuspendToggleButton";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("zh-TW", { hour12: false });
}

const STATUS_LABEL: Record<string, string> = { active: "正常", suspended: "停權", deleted: "已刪除" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildQuery(params: SearchParams, overrides: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const key of ["search", "role", "status", "sort", "page"]) {
    const value = key in overrides ? overrides[key] : first(params[key]);
    if (value) query.set(key, value);
  }
  return query.toString();
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const currentUser = await getCurrentUser();

  const search = first(params.search) ?? "";
  const role = first(params.role) as ListUsersOptions["role"] | undefined;
  const status = (first(params.status) as ListUsersOptions["status"] | undefined) ?? "all";
  const sort = (first(params.sort) as ListUsersOptions["sort"] | undefined) ?? "created_desc";
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);

  const { users, total } = await listUsers({ search, role, status, sort, page });
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));

  return (
    <main>
      <h1 className="text-2xl font-bold">使用者列表</h1>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4" method="GET">
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          搜尋
          <input
            name="search"
            defaultValue={search}
            placeholder="Email / 顯示名稱 / 電話"
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-gold focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          角色
          <select
            name="role"
            defaultValue={role ?? ""}
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-gold focus:outline-none"
          >
            <option value="">全部</option>
            <option value="admin">管理員</option>
            <option value="user">一般使用者</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          帳號狀態
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-gold focus:outline-none"
          >
            <option value="all">全部（不含已刪除）</option>
            <option value="active">正常</option>
            <option value="suspended">停權</option>
            <option value="deleted">已刪除</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          排序
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-gold focus:outline-none"
          >
            <option value="created_desc">註冊時間（新→舊）</option>
            <option value="created_asc">註冊時間（舊→新）</option>
            <option value="bid_count_desc">出價次數（多→少）</option>
            <option value="gmv_desc">總成交額（高→低）</option>
          </select>
        </label>
        <button type="submit" className="rounded-md bg-header px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">
          套用
        </button>
      </form>

      {users.length === 0 ? (
        <p className="mt-6 text-ink-light">找不到符合條件的使用者。</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Email</th>
                <th className={th}>顯示名稱</th>
                <th className={th}>角色</th>
                <th className={th}>帳號狀態</th>
                <th className={th}>註冊時間</th>
                <th className={th}>出價次數</th>
                <th className={th}>總成交額</th>
                <th className={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className={td}>
                    <Link href={`/z04urru6/users/${user.id}`} className="font-medium text-gold hover:underline">
                      {user.email}
                    </Link>
                  </td>
                  <td className={td}>{user.displayName ?? "—"}</td>
                  <td className={td}>{user.role === "admin" ? "管理員" : "一般使用者"}</td>
                  <td className={td}>{STATUS_LABEL[user.status]}</td>
                  <td className={td}>{formatDate(user.createdAt)}</td>
                  <td className={td}>{user.bidCount}</td>
                  <td className={td}>{user.totalWon}</td>
                  <td className={td}>
                    {user.status === "deleted" ? (
                      <span className="text-xs text-ink-light">已刪除，無法操作</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <RoleToggleButton userId={user.id} currentRole={user.role} isSelf={user.id === currentUser?.id} />
                        <SuspendToggleButton
                          userId={user.id}
                          isSuspended={user.status === "suspended"}
                          isSelf={user.id === currentUser?.id}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={`/z04urru6/users?${buildQuery(params, { page: String(page - 1) })}`}
              className="text-gold hover:underline"
            >
              上一頁
            </Link>
          )}
          <span className="text-ink-light">
            第 {page} / {totalPages} 頁（共 {total} 位使用者）
          </span>
          {page < totalPages && (
            <Link
              href={`/z04urru6/users?${buildQuery(params, { page: String(page + 1) })}`}
              className="text-gold hover:underline"
            >
              下一頁
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
