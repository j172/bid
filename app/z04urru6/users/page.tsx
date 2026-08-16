import Link from "next/link";
import { getCurrentUser, listUsers, USERS_PAGE_SIZE, type ListUsersOptions } from "@/lib/auth";
import { formatAdminDateTime } from "@/lib/format";
import RoleToggleButton from "./RoleToggleButton";
import SuspendToggleButton from "./SuspendToggleButton";
import ResetPasswordButton from "./ResetPasswordButton";
import AdminPageIntro from "../AdminPageIntro";
import AdminPagination from "../components/AdminPagination";
import { parseFirstParam, parsePageParam, type SearchParams } from "../components/searchParams";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import { filterControlClass, filterFormClass, filterLabelClass, filterSubmitClass } from "../components/tableStyles";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { active: "正常", suspended: "停權", deleted: "已刪除" };

const QUERY_KEYS = ["search", "role", "status", "sort", "page"] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const currentUser = await getCurrentUser();

  const search = parseFirstParam(params.search) ?? "";
  const role = parseFirstParam(params.role) as ListUsersOptions["role"] | undefined;
  const status = (parseFirstParam(params.status) as ListUsersOptions["status"] | undefined) ?? "all";
  const sort = (parseFirstParam(params.sort) as ListUsersOptions["sort"] | undefined) ?? "created_desc";
  const requestedPage = parsePageParam(params.page);

  const { users, total } = await listUsers({ search, role, status, sort, page: requestedPage });
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  // 超出範圍的 page 夾回最後一頁，避免分頁列顯示「第 999 / 3 頁」（issue #139 L3）。
  const page = Math.min(requestedPage, totalPages);

  return (
    <main>
      <AdminPageIntro title="使用者列表" description="管理帳號角色、停權狀態與使用者活躍度。" />

      <form className={filterFormClass} method="GET">
        <label className={filterLabelClass}>
          搜尋
          <input name="search" defaultValue={search} placeholder="Email / 顯示名稱 / 電話" className={filterControlClass} />
        </label>
        <label className={filterLabelClass}>
          角色
          <select name="role" defaultValue={role ?? ""} className={filterControlClass}>
            <option value="">全部</option>
            <option value="admin">管理員</option>
            <option value="user">一般使用者</option>
          </select>
        </label>
        <label className={filterLabelClass}>
          帳號狀態
          <select name="status" defaultValue={status} className={filterControlClass}>
            <option value="all">全部（不含已刪除）</option>
            <option value="active">正常</option>
            <option value="suspended">停權</option>
            <option value="deleted">已刪除</option>
          </select>
        </label>
        <label className={filterLabelClass}>
          排序
          <select name="sort" defaultValue={sort} className={filterControlClass}>
            <option value="created_desc">註冊時間（新→舊）</option>
            <option value="created_asc">註冊時間（舊→新）</option>
            <option value="bid_count_desc">出價次數（多→少）</option>
            <option value="gmv_desc">總成交額（高→低）</option>
          </select>
        </label>
        <button type="submit" className={filterSubmitClass}>
          套用
        </button>
      </form>

      {users.length === 0 ? (
        <p className="mt-6 text-ink-light">找不到符合條件的使用者。</p>
      ) : (
        <AdminTable headers={["Email", "顯示名稱", "角色", "帳號狀態", "註冊時間", "出價次數", "總成交額", "操作"]}>
          {users.map((user) => (
            <AdminTableRow key={user.id}>
              <AdminTableCell>
                <Link href={`/z04urru6/users/${user.id}`} className="font-medium text-interactive-primary hover:underline">
                  {user.email}
                </Link>
              </AdminTableCell>
              <AdminTableCell>{user.displayName ?? "—"}</AdminTableCell>
              <AdminTableCell>{user.role === "admin" ? "管理員" : "一般使用者"}</AdminTableCell>
              <AdminTableCell>{STATUS_LABEL[user.status]}</AdminTableCell>
              <AdminTableCell>{formatAdminDateTime(user.createdAt)}</AdminTableCell>
              <AdminTableCell>{user.bidCount}</AdminTableCell>
              <AdminTableCell>{user.totalWon}</AdminTableCell>
              <AdminTableCell>
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
                    <ResetPasswordButton userId={user.id} email={user.email} />
                  </div>
                )}
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      <AdminPagination
        basePath="/z04urru6/users"
        page={page}
        totalPages={totalPages}
        total={total}
        params={params}
        keys={QUERY_KEYS}
        totalUnit="位使用者"
      />
    </main>
  );
}
