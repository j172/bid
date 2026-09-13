# SPEC: 全面移除「賽事資訊」所有功能 (Decommission Races Feature & Clean up Subsystems)

## 1. 背景與問題 (Background & Context)

在先前 Issue #239 / #241 中，系統加入了「賽事資訊」（Races）功能，包含定時自外部來源（龍馬賽鴿網 loing-ma.com 與比利時赫伯特 herbots.be）爬取賽事資訊，並透過 Cloudflare Workers AI 自動翻譯為正體中文，匯入資料庫 `races` 表，並在前台提供首頁展示區塊、獨立賽事清單頁面（`/races`），以及後台管理與手動同步功能。

然而，經業務評估與決策，該功能不再符合平台核心價值，需徹底下線：
1. **維護與外部依賴成本過高**：外部論壇與網站架構更動時易導致爬蟲失效，且每日排程增加伺服器與 Cloudflare Workers AI 請求負擔。
2. **前台版面簡化**：首頁「賽事資訊」區塊佔據版面，移除後可讓「官方社群影音」與「即時氣象」緊密串接。
3. **資料庫與架構精簡**：移除無用之資料表與多國語系鍵值，降低代碼庫複雜度與測試維護成本。

---

## 2. 解決方案與規格 (Solution & Specifications)

### 2.1 資料庫與綱要定義 (Database & Schema)
- **`lib/db.ts`** 與 **`db/init.sql`**：
  - 從 `SCHEMA_SQL` 與初始結構中徹底移除 `CREATE TABLE IF NOT EXISTS races (...)` 定義。
  - 更新 `sync_runs` 註解，`job_name` 僅保留 `'news'`。
- **線上資料庫清除指令**（供維運手動或 migration 執行）：
  ```sql
  DROP TABLE IF EXISTS races;
  DELETE FROM sync_runs WHERE job_name = 'races';
  ```

### 2.2 前台頁面與組件 (Public Frontend & Components)
- **`app/[locale]/races/page.tsx`**：徹底刪除此頁面，存取 `/races` 與各語系 `/races` 自然回傳 404 Not Found。
- **`app/[locale]/components/RaceCard.tsx`**：徹底刪除賽事卡片組件。
- **`app/[locale]/(with-loading)/page.tsx`**（首頁）：
  - 移除 `cachedQuery("home:latestRaces", ...)` 資料查詢與 `raceCardItems` mapping。
  - 移除首頁賽事區塊，由官方社群影音動態順接即時氣象區塊。
- **`app/sitemap.ts`**：移除 `/races` 的 sitemap 條目。

### 2.3 後台管理與手動同步 (Admin UI & APIs)
- **`app/z04urru6/races/page.tsx`** & **`RacesSyncButton.tsx`**：徹底刪除後台賽事管理頁面與組件。
- **`app/z04urru6/adminNav.ts`**：從導覽項目中移除 `{ label: "賽事管理", href: "/z04urru6/races", section: "content" }`。
- **`app/api/admin/races/sync/route.ts`**：徹底刪除手動同步 API 端點。
- **`app/z04urru6/components/parseSyncApiResponse.ts`**：更新註解，移除 `RacesSyncButton` 引用。

### 2.4 背景排程、爬蟲模組與資料存取層 (Background Jobs & Scrapers)
- **`lib/scheduler.ts`** & **`lib/scheduler.test.ts`**：
  - 移除每日 08:40 賽事同步 cron 排程。
  - 移除開機後的賽事 catch-up 檢查。
  - 排程測試註冊計數由 3 降為 2（匯率與新聞）。
- **`lib/syncRuns.ts`** & **`lib/syncRuns.test.ts`**：
  - 將 `SyncJobName` 型別定義由 `"news" | "races"` 縮減為 `"news"`。
- **`lib/uploads.ts`**：
  - 移除 `saveRaceImageFromBuffer`、`raceImageUrl`、`deleteRaceImageFile`。
- **`lib/translate.ts`**：
  - 更新檔案註解，移除 race sync 相關描述。
- **刪除之業務模組與測試**：
  - `lib/races.ts` & `lib/races.test.ts`
  - `lib/racesSync.ts` & `lib/racesSync.test.ts`
  - `lib/loingMaRaces.ts` & `lib/loingMaRaces.test.ts`
  - `lib/herbotsRaces.ts` & `lib/herbotsRaces.test.ts`

### 2.5 多國語言辭典 (i18n Messages)
- **`messages/zh-TW.json`**, **`messages/zh-CN.json`**, **`messages/en.json`**：
  - 移除首頁 4 個翻譯鍵：`racesEyebrow`, `racesTitle`, `racesCta`, `racesEmptyDesc`。
  - 移除整個 `"races": { ... }` 命名空間。

---

## 3. 非目標 (Non-goals)

- 不針對 `/races` 做 301 轉址（依據決策共識，直接 404 讓搜尋引擎自然除名）。
- 不保留任何爬蟲客戶端或歷史賽事資料。

---

## 4. 驗證計劃與標準 (Verification Plan & Standards)

1. **單元測試 (Unit Tests)**：
   - 執行 `npm test -- --run`，全專案測試無任何失敗，所有受影響之排程與同步測試皆正常通過。
2. **型別檢查 (Typecheck)**：
   - 執行 `npm run typecheck`，全專案 0 TypeScript 錯誤。
3. **代碼規範 (Lint)**：
   - 執行 `npm run lint`，0 ESLint 錯誤。
4. **生產環境建置 (Production Build)**：
   - 執行 `npm run build`，所有靜態頁面順利打包，無 `/races` 路由殘留。
