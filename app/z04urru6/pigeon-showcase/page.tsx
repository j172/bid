import Link from "next/link";
import { listHomepageSections } from "@/lib/homepageSections";
import {
  PIGEON_SHOWCASE_PAGE_SIZES,
  DEFAULT_PIGEON_SHOWCASE_PAGE_SIZE,
  isPigeonShowcasePageSize,
  listPigeonShowcase,
  type PigeonShowcaseCategory,
} from "@/lib/pigeonShowcase";
import { isPigeonShowcaseCategory } from "@/lib/pigeonShowcaseValidation";
import { pigeonShowcaseImageUrl } from "@/lib/uploads";
import AdminPageIntro from "../AdminPageIntro";
import PigeonShowcaseFormModal from "./PigeonShowcaseFormModal";
import DeleteButton from "./DeleteButton";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

const CATEGORY_LABEL: Record<PigeonShowcaseCategory, string> = { award: "入賞鴿", imported: "進口鴿" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildQuery(params: SearchParams, overrides: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const key of ["category", "search", "loftId", "pageSize", "page"]) {
    const value = key in overrides ? overrides[key] : first(params[key]);
    if (value) query.set(key, value);
  }
  return query.toString();
}

export default async function PigeonShowcaseAdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const categoryRaw = first(params.category) ?? "";
  const category = isPigeonShowcaseCategory(categoryRaw) ? categoryRaw : undefined;
  const search = first(params.search) ?? "";
  const loftIdRaw = first(params.loftId) ?? "";
  const loftId = loftIdRaw ? Number(loftIdRaw) : undefined;
  const pageSizeRaw = Number(first(params.pageSize));
  const pageSize = isPigeonShowcasePageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_PIGEON_SHOWCASE_PAGE_SIZE;
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);

  // activeOnly: false — admins need to see/filter by every 合作鴿舍, including
  // ones since deactivated on the homepage, since pigeon_showcase rows can
  // still reference them (same reasoning as the partner-lofts admin page).
  const [{ items, total }, lofts] = await Promise.all([
    listPigeonShowcase({ category, search, loftId, page, pageSize }),
    listHomepageSections("partner_loft"),
  ]);
  const loftOptions = lofts.map((loft) => ({ id: loft.id, title: loft.title }));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main>
      <AdminPageIntro title="入賞鴿／進口鴿管理" description="管理首頁輪播與分類清單頁使用的入賞鴿／進口鴿資料。">
        <PigeonShowcaseFormModal mode="create" lofts={loftOptions} />
      </AdminPageIntro>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm" method="GET">
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          鴿種
          <select name="category" defaultValue={category ?? ""} className="rounded-md border border-border px-2 py-1 text-sm focus:border-interactive-primary focus:outline-none">
            <option value="">全部</option>
            <option value="award">入賞鴿</option>
            <option value="imported">進口鴿</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          名稱
          <input
            name="search"
            defaultValue={search}
            placeholder="搜尋名稱"
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-interactive-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          鴿舍
          <select name="loftId" defaultValue={loftId ? String(loftId) : ""} className="rounded-md border border-border px-2 py-1 text-sm focus:border-interactive-primary focus:outline-none">
            <option value="">全部</option>
            {loftOptions.map((loft) => (
              <option key={loft.id} value={loft.id}>
                {loft.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          每頁筆數
          <select name="pageSize" defaultValue={String(pageSize)} className="rounded-md border border-border px-2 py-1 text-sm focus:border-interactive-primary focus:outline-none">
            {PIGEON_SHOWCASE_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-interactive-primary px-4 py-2 text-sm font-medium text-white hover:bg-interactive-primary-active">
          套用
        </button>
      </form>

      {items.length === 0 ? (
        <p className="mt-6 text-ink-light">找不到符合條件的鴿況資料。</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>主圖</th>
                <th className={th}>鴿種</th>
                <th className={th}>名稱</th>
                <th className={th}>鴿舍</th>
                <th className={th}>簡介</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const imageUrl = item.imageFileName ? pigeonShowcaseImageUrl(item.imageFileName) : "/images/hero-placeholder.png";
                return (
                  <tr key={item.id} className="transition hover:bg-surface-muted/80">
                    <td className={td}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt={item.name} className="h-14 w-14 rounded-lg border border-border object-cover" />
                    </td>
                    <td className={td}>{CATEGORY_LABEL[item.category]}</td>
                    <td className={`${td} font-medium`}>{item.name}</td>
                    <td className={td}>{item.loftTitle}</td>
                    <td className={`${td} max-w-xs truncate text-ink-light`}>{item.description.replace(/<[^>]*>/g, " ").trim()}</td>
                    <td className={`${td} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        <PigeonShowcaseFormModal
                          mode="edit"
                          lofts={loftOptions}
                          item={{
                            id: item.id,
                            category: item.category,
                            name: item.name,
                            loftId: item.loftId,
                            description: item.description,
                            imageUrl,
                          }}
                        />
                        <DeleteButton id={item.id} name={item.name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2 text-sm shadow-sm">
          {page > 1 && (
            <Link href={`/z04urru6/pigeon-showcase?${buildQuery(params, { page: String(page - 1) })}`} className="text-interactive-primary hover:underline">
              上一頁
            </Link>
          )}
          <span className="text-ink-light">
            第 {page} / {totalPages} 頁（共 {total} 筆）
          </span>
          {page < totalPages && (
            <Link href={`/z04urru6/pigeon-showcase?${buildQuery(params, { page: String(page + 1) })}`} className="text-interactive-primary hover:underline">
              下一頁
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
