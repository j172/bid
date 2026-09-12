import {
  DEFAULT_RACE_PAGE_SIZE,
  RACE_PAGE_SIZES,
  RACE_STATUSES,
  isRacePageSize,
  isRaceStatus,
  listRaces,
  type RaceStatus,
} from "@/lib/races";
import AdminPageIntro from "../AdminPageIntro";
import AdminPagination from "../components/AdminPagination";
import { parseFirstParam, parsePageParam, type SearchParams } from "../components/searchParams";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import { filterControlClass, filterFormClass, filterLabelClass, filterSubmitClass } from "../components/tableStyles";
import RacesSyncButton from "./RacesSyncButton";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = { loing_ma: "loing-ma.com", herbots: "herbots.be" };
const STATUS_LABEL: Record<RaceStatus, string> = { current: "正在進行", future: "即將開賽", finished: "過往賽事" };

const QUERY_KEYS = ["status", "pageSize", "page"] as const;

// 賽事管理 (issue #255) — deliberately minimal: the daily sync (issue #241)
// already keeps `races` up to date on its own, so this page's job is just
// (a) let an admin trigger that sync on demand instead of waiting for the
// next 08:40 Asia/Taipei tick or SSHing in to read logs, and (b) a read-only
// list to sanity-check what landed — same list shape as the public /races
// page's data (lib/races.ts's listRaces), just without the public page's
// card/image layout. No CRUD here: unlike news_posts, every race row is
// owned by the sync (see lib/racesSync.ts's upsertRace, keyed on source_url)
// and would just be overwritten on the next run, so hand-editing a race here
// would be misleading.
export default async function RacesAdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const statusRaw = parseFirstParam(params.status);
  const status = statusRaw && isRaceStatus(statusRaw) ? statusRaw : undefined;
  const pageSizeRaw = Number(parseFirstParam(params.pageSize));
  const pageSize = isRacePageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_RACE_PAGE_SIZE;
  const requestedPage = parsePageParam(params.page);

  const { items, total } = await listRaces({ status, page: requestedPage, pageSize });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  return (
    <main>
      <AdminPageIntro
        title="賽事管理"
        description="管理首頁「賽事資訊」專區與 /races 清單頁使用的資料。資料每日自動從 loing-ma.com、herbots.be 同步；下方僅供檢視，個別賽事會在下次自動同步時被來源資料覆寫，故不提供手動編輯。"
      >
        <div className="flex flex-wrap items-center justify-end gap-3">
          <RacesSyncButton />
        </div>
      </AdminPageIntro>

      <form className={filterFormClass} method="GET">
        <label className={filterLabelClass}>
          狀態
          <select name="status" defaultValue={status ?? ""} className={filterControlClass}>
            <option value="">全部</option>
            {RACE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label className={filterLabelClass}>
          每頁筆數
          <select name="pageSize" defaultValue={String(pageSize)} className={filterControlClass}>
            {RACE_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={filterSubmitClass}>
          套用
        </button>
      </form>

      {items.length === 0 ? (
        <p className="mt-6 text-ink-light">目前沒有賽事資料，請點選上方按鈕手動同步，或等待每日排程執行。</p>
      ) : (
        <AdminTable headers={["來源", "狀態", "標題", "開賽日期", "更新時間", "來源連結"]}>
          {items.map((item) => (
            <AdminTableRow key={item.id}>
              <AdminTableCell className="whitespace-nowrap text-xs text-ink-light">{SOURCE_LABEL[item.source] ?? item.source}</AdminTableCell>
              <AdminTableCell className="whitespace-nowrap text-xs text-ink-light">{STATUS_LABEL[item.status]}</AdminTableCell>
              <AdminTableCell className="max-w-xs truncate font-medium">{item.title}</AdminTableCell>
              <AdminTableCell className="whitespace-nowrap text-ink-light">
                {item.raceDate ? item.raceDate.toLocaleDateString("zh-TW") : "—"}
              </AdminTableCell>
              <AdminTableCell className="whitespace-nowrap text-ink-light">{item.updatedAt.toLocaleString("zh-TW")}</AdminTableCell>
              <AdminTableCell>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-interactive-primary hover:underline"
                >
                  查看原文
                </a>
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      <AdminPagination
        basePath="/z04urru6/races"
        page={page}
        totalPages={totalPages}
        total={total}
        params={params}
        keys={QUERY_KEYS}
      />
    </main>
  );
}
