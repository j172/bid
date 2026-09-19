# SPEC: 鴿種介紹專區改版、三豐攝影專區與首頁社群影音調整

## 1. 背景與目標 (Outcome)

為了提升平台內容策展的專業度與靈活性，本規格涵蓋首頁與後台展示系統之六項關鍵調整：
1. **首頁精簡**：移除已過時或重複之「今日焦點鴿況」區塊，優化載入體驗與視覺動線。
2. **後台選單語意優化**：將「入賞鴿／進口鴿管理」正式更名為「鴿種介紹專區」，使名稱更精準涵蓋多樣化名鴿內容。
3. **名鴿展示（pigeon_showcase）結構擴充**：
   - 「世界名鴿（world_famous）」類別允許無綁定特定站內鴿舍（`loft_id` 可為 `NULL`）。
   - 新增「照片來源（`photo_source`）」屬性，後台提供固定選單（未指定、三豐攝影、舍內自拍、其他），前台名鴿展示詳情頁依填寫狀況展示「攝影來源：{photoSource}」。
4. **首頁專題區塊更新**：以「三豐攝影名鴿特輯」替換既有「定價種鴿」區塊，展示照片來源為「三豐攝影」之名鴿精選（最多 6 筆），無內容時呈現友善空狀態。
5. **官方影音顯示上限調整**：將首頁官方社群 YouTube 影片顯示數量由 6 部調整為 4 部，維持 3 欄 RWD 佈局，精簡版面高度。
6. **頁尾友站連結導流**：於頁尾「鴿界目錄」分類下新增外部連結「三豐攝影」，帶有 UTM 來源追蹤標籤並於新分頁開啟。

---

## 2. 範圍與受影響模組 (Scope)

### 資料庫與後端模組
- `db/init.sql`：更新 `pigeon_showcase` schema 定義（`loft_id BIGINT NULL`、`photo_source VARCHAR(100) NULL`）。
- `lib/db.ts`：啟動自動遷移 `ensurePigeonShowcasePhotoSource()`。
- `scripts/migrate-pigeon-showcase-photo-source.mjs`：獨立資料庫遷移腳本。
- `lib/pigeonShowcase.ts`：更新型別與查詢邏輯，支援 `photoSource`、nullable `loftId`，新增 `listPigeonShowcaseByPhotoSource`。
- `lib/pigeonShowcaseValidation.ts`：新增 `PHOTO_SOURCE_OPTIONS` 與輸入驗證。
- `lib/socialMedia.ts`：調整 YouTube 抓取上限為 4 部。
- `app/api/admin/pigeon-showcase/route.ts` & `[id]/route.ts`：前後端 CRUD API 支援 `photoSource` 與 `loft_id` 可為空。

### 後台管理介面
- `app/z04urru6/AdminShell.tsx` & `app/z04urru6/adminNav.ts`：導航選單項目名稱更名為「鴿種介紹專區」。
- `app/z04urru6/pigeon-showcase/PigeonShowcaseFormModal.tsx`：支援世界名鴿免選鴿舍、新增「照片來源」下拉選單。
- `app/z04urru6/pigeon-showcase/page.tsx`：後台列表增加「照片來源」資訊顯示欄位。

### 前台與多語系
- `app/[locale]/(with-loading)/page.tsx`：首頁移除今日焦點，以三豐攝影名鴿特輯替換定價種鴿。
- `app/[locale]/(no-loading)/pigeon-showcase/[id]/page.tsx`：前台詳情頁顯示「攝影來源」，鴿舍為空時安全略過鴿舍連結。
- `app/[locale]/pigeon-showcase/page.tsx`：列表頁面徽章型別容錯處理。
- `app/[locale]/components/SiteFooter.tsx`：頁尾「鴿界目錄」新增三豐攝影 UTM 外部連結。
- `messages/zh-TW.json`, `messages/zh-CN.json`, `messages/en.json`：補充首頁專題與攝影來源之多語系字串。

---

## 3. 非目標 (Non-goals)

- 不刪除 `pigeon_showcase` 既有資料。
- 不強制修改舊有資料之 `photo_source`，歷史資料維持 `NULL`（顯示為未指定）。
- 不調整 YouTube 影音除上限以外之 RSS 抓取、快取或 fallback 邏輯。
- 不更動頁尾其他分類或社交連結。

---

## 4. 驗收條件 (Acceptance Criteria)

- [x] 首頁不再渲染「今日焦點鴿況」區塊。
- [x] 後台左側導覽列將「入賞鴿／進口鴿管理」正名為「鴿種介紹專區」。
- [x] `pigeon_showcase` 資料表支援 `loft_id NULL` 與 `photo_source VARCHAR(100) NULL`。
- [x] 後台新增與編輯名鴿展示時，若分類為世界名鴿可不填鴿舍；照片來源提供固定下拉選項（未指定 / 三豐攝影 / 舍內自拍 / 其他）。
- [x] 前台名鴿詳情頁若有填寫照片來源，於鴿舍下方顯示「攝影來源：{photoSource}」；若 `loft_id` 為空則不報錯且隱藏鴿舍欄位。
- [x] 首頁「定價種鴿」原位置替換為「三豐攝影名鴿特輯」，僅顯示 `photo_source = '三豐攝影'` 之項目（最多 6 筆），無項目時顯示虛線相機空狀態卡片。
- [x] 首頁官方 YouTube 影片列表嚴格限制最多 4 筆。
- [x] 頁尾「鴿界目錄」區塊包含指向「三豐攝影」之連結，帶有指定 UTM 參數且以新分頁開啟。
- [x] 單元測試、型別檢查、程式碼風格檢查全數通過。

---

## 5. 測試與驗證 (Verification)

- 單元測試：`npm test`（特別包含 `lib/pigeonShowcase.test.ts` 與 `lib/socialMedia.test.ts`）。
- 靜態檢查：`npm run typecheck`、`npm run lint`。
- 建置檢查：`npm run build`。

---

## 6. 風險與回滾計畫 (Risks & Rollback)

- **資料庫遷移**：`loft_id` 轉為 nullable 與新增 `photo_source` 為向下相容之變更（Additive change），舊版程式碼亦可正常運作；`ensurePigeonShowcasePhotoSource()` 具冪等性。
- **回滾方案**：若需回滾，只需 revert 本次 commit，資料庫多出之欄位不影響舊版運作。
