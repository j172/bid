# SPEC: 商品列表頁名家專區移至頁尾並新增 30/50/100 分頁器 (Listings Featured Lofts Bottom Placement & Pager)

## 1. Outcome (預期成果)
在商品列表頁面（`/listings`，包含特定合作鴿舍篩選 `/listings?loft=[id]`），將原先置於頁面頂部（鴿舍橫幅下方、商品網格上方）的「名家專區」區塊，移至整頁主內容最底端（商品網格或舍內名鴿展示網格下方、全站 Footer 正上方）。區塊佈局調整為 5 欄滿格（`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`），支援 30 / 50 / 100 每頁筆數切換分頁器，並透過 `#featured-lofts` 錨點實現翻頁與切換後的平滑頂部對齊定位。

## 2. Source and Ownership (來源與負責人)
- **來源**：使用者需求訪談（GRILL ME 決策樹確認共識）。
- **負責人**：Jay FC / AI Agent。

## 3. Scope (涵蓋範圍)
- **影響路由**：
  - `app/[locale]/listings/(with-loading)/page.tsx`
- **資料存取層**：
  - `lib/featuredLoftPosts.ts`：沿用 `listFeaturedLoftPosts({ page, pageSize })` 與既有分頁常數 `FEATURED_LOFT_POST_PAGE_SIZES = [30, 50, 100]`。
- **共用輔助與元件**：
  - `app/[locale]/components/PaginationFooter.tsx`：沿用共用分頁器。
  - `lib/searchParams.ts`：輔助解析與組裝網址參數。
- **多語系翻譯**：
  - 沿用 `messages/zh-TW.json`, `messages/zh-CN.json`, `messages/en.json` 的 `featuredLofts` 命名空間。

## 4. Non-goals (非本次目標)
- 不修改 `/featured-lofts` 專題文章清單頁（維持現有清單結構與既有每頁筆數）。
- 不變更全站共用 `SiteFooter.tsx`（區塊維持在 listings 頁面容器內）。
- 不變更全域分頁常數（維持 `[30, 50, 100]`）。
- 不更動資料庫綱要。

## 5. Acceptance Criteria (驗收標準)
- [ ] 進入 `/listings` 及 `/listings?loft=[id]` 時，名家專區不再出現在頂部，而是位於商品與展示清單正下方、Footer 之上。
- [ ] 容器具備 `<section id="featured-lofts" className="mt-12 scroll-mt-20 border-t border-border pt-8">` 樣式與錨點。
- [ ] 桌機版採用 5 欄滿格佈局（`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3`），使 30 / 50 / 100 筆數皆能完整整除。
- [ ] 預設每頁顯示 30 筆，並提供 30 / 50 / 100 筆數切換。
- [ ] 使用獨立參數 `featuredPage` 與 `featuredPageSize`，翻頁或切換筆數時完整保留當前商品的搜尋與篩選參數。
- [ ] 分頁器連結自動附帶 `#featured-lofts` 錨點，翻頁後自動平滑捲動至名家專區頂部。
- [ ] 若無名家專區文章（`total === 0`），該區塊完全不渲染，亦不產生錯誤。
- [ ] 多語系文字無缺失或報錯。

## 6. Verification (驗證方式)
- **單元測試**：
  - 驗證參數解析、分頁常數與 URL 產生邏輯。
  - 執行 `npm test` 通過所有測試。
- **型別與語法檢查**：
  - 執行 `npm run typecheck` 0 錯誤。
  - 執行 `npm run lint` 0 警告/錯誤。
- **生產建置**：
  - 執行 `npm run build` 成功建置。
- **部署冒煙測試**：
  - 推送到 `master`，由 GitHub Actions 自動執行 FTPS 部署並由遠端執行驗證。

## 7. Risks and Rollout (風險與發布)
- **資料庫影響**：純讀取，無 migration 風險。
- **部署影響**：標準 Next.js App Router 渲染，依賴標準部署流程。
- **回滾計畫**：若有非預期錯誤，可藉由 GitHub Actions 回滾至上一穩定版本或 revert commit。

## 8. Open Decisions (未決事項)
- 無（已於 GRILL ME 階段全數釐清並取得確認）。
