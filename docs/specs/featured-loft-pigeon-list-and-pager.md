# SPEC: 名家專區文章詳情頁展示該鴿舍所有鴿子與 30/50/100 分頁器 (Featured Loft Pigeon List & Pager)

## 1. Outcome (預期成果)
在名家專區專題文章頁面（`/featured-lofts/[id]`，例如 `/featured-lofts/1`）文末，若該文章已設定關聯合作鴿舍（`loftId`），直接列出該鴿舍的所有鴿子，提供「拍賣鴿（在售/結標）」與「名鴿展示（入賞/進口/代表種鴿）」雙 Tab 切換、由新至舊排序（進行中拍賣優先置頂）、30 / 50 / 100 每頁筆數切換分頁器，並透過 `#loft-pigeons` 錨點實現翻頁與切換後的流暢頂部對齊定位。

## 2. Source and Ownership (來源與負責人)
- **來源**：使用者需求訪談（GRILL ME 決策樹確認共識）。
- **負責人**：Jay FC / AI Agent。

## 3. Scope (涵蓋範圍)
- **影響路由**：
  - `app/[locale]/(no-loading)/featured-lofts/[id]/page.tsx`
- **資料庫與資料存取層**：
  - `lib/listings.ts`：新增/支援 `listOpenListingsPaginated` 分頁查詢（支援 `page`, `pageSize`, `loftId`, `statusScope = 'all'`，進行中商品置頂且依 `created_at DESC`，結標商品依 `created_at/ends_at DESC`）。
  - `lib/pigeonShowcase.ts`：確保 `listPigeonShowcase` 支援 30 / 50 / 100 分頁切換。
- **共用輔助與元件**：
  - `lib/featuredLoftPosts.ts` 或 `lib/loftStorefront.ts`：提供分頁筆數常數與 URL 產生輔助函式。
  - `app/[locale]/components/PaginationFooter.tsx`：沿用共用分頁器。
  - `app/[locale]/components/ProductCard.tsx`：拍賣鴿卡片展示。
- **多語系翻譯**：
  - `messages/zh-TW.json`, `messages/zh-CN.json`, `messages/en.json`

## 4. Non-goals (非本次目標)
- 不修改 `/featured-lofts` 文章清單頁面（維持現有清單結構與既有每頁筆數）。
- 不變更 `/listings?loft=<id>` 既有獨立商城的篩選功能。
- 不改變資料庫綱要（`featured_loft_posts`, `listings`, `pigeon_showcase`, `homepage_sections` 現有欄位已滿足需求）。

## 5. Acceptance Criteria (驗收標準)
- [ ] 進入 `/featured-lofts/[id]` 時，若該文章關聯 `loftId`，內文下方顯示「【鴿舍名稱】所有鴿子」展示區塊（帶有 `id="loft-pigeons"`）。
- [ ] 若文章未關聯 `loftId`（`item.loftId === null`），該區塊完全不渲染，亦不產生錯誤。
- [ ] 提供「拍賣鴿」與「名鴿展示」Tab 切換，並顯示當前分類數量。
- [ ] 「拍賣鴿」清單涵蓋該鴿舍歷來所有拍品（進行中與已結標），進行中拍品排在最前（由新至舊），結標拍品接續在後（由新至舊）。
- [ ] 「名鴿展示」清單涵蓋該鴿舍的所有名鴿，依 `created_at DESC` 由新至舊排序。
- [ ] 底部提供 Pager 分頁器，支援每頁 30 / 50 / 100 筆切換（預設每頁 30 筆），並正確顯示分頁資訊（第 X / Y 頁，共 Z 筆）。
- [ ] 翻頁、切換每頁筆數、切換 Tab 時，URL 連結自動附帶 `#loft-pigeons` 錨點，換頁後平滑對齊清單頂部。
- [ ] 原內文末端「查看商品」按鈕改為直達錨點按鈕「瀏覽本舍鴿子 ↓」（連往 `#loft-pigeons`），並在清單區塊標題旁提供「在商城開啟 ↗」（連往 `/listings?loft=${item.loftId}`）。
- [ ] 當前 Tab 若無資料，顯示友善空狀態提示（不破版）。
- [ ] `zh-TW`, `zh-CN`, `en` 三種語系皆有完整翻譯文字，無缺漏或報錯。

## 6. Verification (驗證方式)
- **單元測試**：
  - `lib/listings.test.ts`：驗證 `listOpenListingsPaginated` 的分頁、排序（進行中置頂與建立時間由新至舊）與總數計算。
  - `lib/loftStorefront.test.ts` 或相關測試：驗證分頁常數與參數建構。
  - 執行 `npm test` 通過所有測試。
- **型別與語法檢查**：
  - 執行 `npm run typecheck` 0 錯誤。
  - 執行 `npm run lint` 0 警告/錯誤。
- **生產建置**：
  - 執行 `npm run build` 成功建置。
- **部署冒煙測試**：
  - 合併推送到 `master`，由 GitHub Actions 自動執行 FTPS 部署，並在遠端執行 `remote-verify.sh` 驗證成功。

## 7. Risks and Rollout (風險與發布)
- **資料庫影響**：純讀取既有欄位與索引，無 migration 風險。
- **部署影響**：標準 Next.js App Router 靜態/動態混合渲染，依賴標準部署流程。
- **回滾計畫**：若有非預期錯誤，可藉由 GitHub Actions 回滾至上一穩定版本（`rollback` 機制）或 revert PR。

## 8. Open Decisions (未決事項)
- 無（已於 GRILL ME 階段全數釐清並取得確認）。
