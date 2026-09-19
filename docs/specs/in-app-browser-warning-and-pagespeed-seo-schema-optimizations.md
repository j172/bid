# SPEC: 外部瀏覽器警告提示與 PageSpeed / Google Search / Schema.org 全站優化

## 1. Outcome (預期成果)
針對正式營運站點（`https://xiangshuicn.cc/`）落實社群 App 外部瀏覽器警告與全站 PageSpeed / SEO / Schema.org 深層優化：
1. **社群 App In-App Browser 友善提示與引導**：當使用者在 LINE、Facebook、Instagram、WeChat、TikTok 等內建 WebView 中開啟網站時，頂部顯示醒目警告橫幅，防止 Google 登入 403 報錯與 Passkey 失效；動態提供 iOS（Safari）或 Android（Chrome）對應操作指引、一鍵複製網址功能，並支援使用者暫時關閉通知。
2. **PageSpeed 核心網頁指標 (Core Web Vitals) 升級**：
   - 將 Google One Tap 腳本載入策略調整為 `lazyOnload`，且於 In-App 瀏覽器直接不載入，消除主線程 TBT 阻擋。
   - 在全站 `<head>` 預先注入核心第三方網域（`accounts.google.com`、`googletagmanager.com`、`clarity.ms`）之 `preconnect` 與 `dns-prefetch`。
   - 確保首頁 Hero 核心 LCP 圖片保持高優先載入與穩定容器比例，實現零版面位移（Zero CLS）。
3. **Google Search Central 搜尋體驗與爬蟲預算聚焦**：
   - 將購物車（`/cart`）、登入（`/login`）、註冊（`/register`）、忘記密碼（`/forgot-password`）、重設密碼（`/reset-password`）、信箱驗證（`/verify-email`）、會員中心（`/account`）與個人出價紀錄（`/my-bids`）動態注入 `robots: { index: false, follow: true }`，避免搜尋引擎抓取動態與私密頁面，將爬蟲預算 100% 集中於公開拍賣、商品與文章。
4. **Schema.org 結構化資料 (Rich Results) 全面擴充**：
   - `Organization`：補齊 `sameAs` 社群關聯陣列（Facebook、YouTube、TikTok、LINE 官方帳號）。
   - `Product`：補齊 Google 建議之 `brand`、`sku`、`category` 欄位。
   - `ItemList`：拍賣列表頁（`/listings`）導入 Schema.org `ItemList` 集合結構。
   - `SportsClub` / `LocalBusiness`：精選名家鴿舍專題頁（`/featured-lofts/[id]`）導入實體機構結構化資料。

## 2. Source and Ownership (來源與負責人)
- **來源**：使用者需求訪談（Grill Me 共識）與全站 PageSpeed / Google Search Central / Schema.org 最佳實踐標準。
- **負責人**：AI Agent / Jay FC。

## 3. Scope (涵蓋範圍)
- **核心工具函式與設定**：
  - `lib/inAppBrowser.ts`：In-App WebView 偵測與裝置平台判斷。
  - `lib/inAppBrowser.test.ts`：偵測邏輯全覆蓋單元測試。
  - `lib/seo.ts`：擴充 `buildOrganizationJsonLd`、`buildListingProductJsonLd`，新增 `buildItemListJsonLd` 與 `buildLoftBusinessJsonLd`。
  - `lib/seo.test.ts`：結構化資料測試案例更新。
- **前端元件與頁面**：
  - `app/[locale]/components/InAppBrowserBanner.tsx`：頂部黏性警告橫幅元件。
  - `app/[locale]/components/InAppBrowserBanner.test.tsx`：橫幅互動與記憶單元測試。
  - `app/[locale]/components/GoogleOneTap.tsx`：調整載入時機與 In-App 阻擋。
  - `app/[locale]/layout.tsx`：掛載警告橫幅與 DNS prefetch / preconnect。
  - `app/[locale]/listings/(with-loading)/page.tsx`：注入 `ItemList` JSON-LD。
  - `app/[locale]/featured-lofts/[id]/page.tsx`：注入名家結構化標籤。
  - `app/[locale]/cart/page.tsx`：加入 `noindex, follow`。
  - `app/[locale]/login/page.tsx`：加入 `noindex, follow`。
  - `app/[locale]/register/page.tsx`：加入 `noindex, follow`。
  - `app/[locale]/forgot-password/page.tsx`：加入 `noindex, follow`。
  - `app/[locale]/reset-password/page.tsx`：加入 `generateMetadata` 與 `noindex, follow`。
  - `app/[locale]/verify-email/page.tsx`：加入 `generateMetadata` 與 `noindex, follow`。
  - `app/[locale]/account/page.tsx`：加入 `generateMetadata` 與 `noindex, follow`。
  - `app/[locale]/my-bids/page.tsx`：加入 `generateMetadata` 與 `noindex, follow`。
- **多國語系翻譯**：
  - `messages/zh-TW.json`、`messages/zh-CN.json`、`messages/en.json`：新增 `inAppBrowser` 多語系字典。

## 4. Non-goals (非本次目標)
- 不變更現有資料庫結構（Database Schema）。
- 不強制以攔截器中斷 In-App 瀏覽器之一般商品相片瀏覽（維持非阻擋式 Banner）。
- 不啟用 Next.js 伺服器端原生圖片最佳化模組（維持 `unoptimized: true`，防範 PM2 記憶體溢位）。

## 5. Acceptance Criteria (驗收標準)
- [x] 進入 LINE / FB / IG 等 In-App 瀏覽器時，頂部顯示 Amber 提示條，點擊「複製網址」按鈕可複製當前連結並顯示「已複製！」，點擊關閉按鈕後該 Session 不再重複彈出。
- [x] In-App 瀏覽器環境下不載入 Google One Tap，外部瀏覽器下以 `lazyOnload` 載入。
- [x] 全站 `<head>` 正確輸出 Google、GA、Clarity 之 `preconnect` 與 `dns-prefetch` 標籤。
- [x] `/cart`、`/login`、`/register`、`/account`、`/my-bids` 等頁面輸出 `<meta name="robots" content="noindex, follow" />`。
- [x] Schema.org `Organization` 具備 `sameAs` 包含 Facebook、YouTube、TikTok、LINE 連結。
- [x] Schema.org `Product` 包含 `brand`、`sku`、`category`。
- [x] `/listings` 頁面輸出 `ItemList` JSON-LD；名家專題頁輸出 `SportsClub` JSON-LD。
- [x] `npm test` 129 個測試檔案全數通過（含新增之 `inAppBrowser.test.ts` 與 `InAppBrowserBanner.test.tsx`）。
- [x] `npm run typecheck` 與 `npm run lint` 0 錯誤。
- [x] `npm run build` 成功完成全站打包編譯。

## 6. Verification (驗證方式)
- 單元測試：`npm test`（1,305 項測試通過）。
- 型別檢查：`npm run typecheck`（0 錯誤）。
- 語法風格：`npm run lint`（0 錯誤）。
- 生產建置：`npm run build`（116 個路由編譯成功）。
- 部署流程：推送至 `master` 分支，由 GitHub Actions 自動執行 FTP 部署與遠端重啟。

## 7. Risks and Rollout (風險與發布)
- **相容性風險**：極低。所有改動皆相容既有 API 與組件結構。
- **發布方式**：合併至 master，觸發 CI/CD 部署。
- **回滾機制**：若有問題可立即 `git revert` 並重新部署。
