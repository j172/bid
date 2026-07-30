import { listUsers } from "@/lib/auth";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("zh-TW", { hour12: false });
}

export default async function AdminUsersPage() {
  const users = await listUsers();

  return (
    <main>
      <h1 className="text-2xl font-bold">使用者列表</h1>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Email</th>
              <th className={th}>角色</th>
              <th className={th}>註冊時間</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className={td}>{user.email}</td>
                <td className={td}>{user.role === "admin" ? "管理員" : "一般使用者"}</td>
                <td className={td}>{formatDate(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
