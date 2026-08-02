import Link from "next/link";
import { listBroadcasts } from "@/lib/newsletter";
import AdminPageIntro from "../AdminPageIntro";
import CancelBroadcastButton from "./CancelBroadcastButton";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  scheduled: "排程中",
  queued: "寄送中",
  sent: "已寄出",
  canceled: "已取消",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-TW", { hour12: false });
}

export default async function NewsletterPage() {
  const result = await listBroadcasts();

  return (
    <main>
      <AdminPageIntro title="電子報" description="透過 Resend 寄送電子報給訂閱名單。">
        <Link
          href="/z04urru6/newsletter/compose"
          className="inline-block rounded-lg bg-interactive-primary px-4 py-2 text-sm font-medium text-white hover:bg-interactive-primary-active"
        >
          撰寫新電子報
        </Link>
      </AdminPageIntro>

      {!result.ok ? (
        <p className="mt-6 rounded-2xl border border-ended bg-ended-bg p-4 text-sm text-ended">
          {result.errorCode === "NOT_CONFIGURED"
            ? "尚未設定 RESEND_API_KEY 或 RESEND_AUDIENCE_ID，無法讀取電子報列表。"
            : "讀取電子報列表失敗，請稍後再試。"}
        </p>
      ) : result.broadcasts.length === 0 ? (
        <p className="mt-6 text-ink-light">目前沒有任何電子報。</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>主旨</th>
                <th className={th}>狀態</th>
                <th className={th}>排程時間</th>
                <th className={th}>建立時間</th>
                <th className={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {result.broadcasts.map((broadcast) => (
                <tr key={broadcast.id} className="transition hover:bg-surface-muted/80">
                  <td className={td}>{broadcast.subject ?? "（未命名）"}</td>
                  <td className={td}>{STATUS_LABEL[broadcast.status] ?? broadcast.status}</td>
                  <td className={td}>{formatDate(broadcast.scheduledAt)}</td>
                  <td className={td}>{formatDate(broadcast.createdAt)}</td>
                  <td className={td}>
                    {broadcast.status === "draft" || broadcast.status === "scheduled" ? (
                      <CancelBroadcastButton broadcastId={broadcast.id} />
                    ) : (
                      <span className="text-xs text-ink-light">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
