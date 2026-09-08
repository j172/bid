# SPEC: 全站 QA 與 PageSpeed 效能優化 (QA & PageSpeed Optimizations)

## 1. Outcome (預期成果)
針對正式營運站點（`https://xiangshuicn.cc/`）進行全面 QA 與 PageSpeed 效能優化：
1. 解決 Google PageSpeed 主線程長時間阻塞問題（將第三方 Clarity 載入時機調整，消除約 1.89 秒 TBT 延遲）。
2. 在客戶端圖片轉檔壓縮管線增加尺寸上限（限制寬高最大 1600px），避免巨型圖片上傳造成頻寬浪費與伺服器記憶體溢位。
3. 補齊所有核心使用者頁面（`/cart`、`/login`、`/register`、`/forgot-password`）之動態 SEO Metadata 與多語系 Alternates 標籤，解決搜尋引擎索引缺失。
4. 修復無障礙（Accessibility）與 UIUX 缺陷：提升語系切換器之顏色對比度（符合 WCAG AA）、補齊電子報與搜尋元件之 `aria-label`、增大行動端社群按鈕點擊區域至 40px 以上。
5. 清理全站法律與服務政策條款頁面（隱私權、退款政策、使用條款、GDPR）之示範樣板文字與未定資料佔位符，提供合規之商業服務資訊。

## 2. Source and Ownership (來源與負責人)
- **來源**：正式站全面 QA 與 Google PageSpeed Insights 稽核報告（Issue #233）。
- **負責人**：Jay FC / AI Agent。

## 3. Scope (涵蓋範圍)
- **影響路由與頁面**：
  - `app/[locale]/cart/page.tsx`
  - `app/[locale]/login/page.tsx`
  - `app/[locale]/register/page.tsx`（重構分離出 `RegisterForm.tsx`）
  - `app/[locale]/forgot-password/page.tsx`（重構分離出 `ForgotPasswordForm.tsx`）
- **共用 UI 元件**：
  - `app/[locale]/components/SiteHeader.tsx`：搜尋表單之多語系路由重導向與 aria 標籤。
  - `app/[locale]/components/SiteFooter.tsx`：社群按鈕尺寸擴充至 `min-w-[40px] min-h-[40px]`。
  - `app/[locale]/components/LanguageSwitcher.tsx`：調整選單色彩對比度。
  - `app/[locale]/components/NewsletterForm.tsx`：補齊表單無障礙標籤。
  - `app/[locale]/components/MicrosoftClarity.tsx`：調整 Script 載入策略為 `lazyOnload`。
- **客戶端工具庫**：
  - `lib/convertPhotoToWebp.ts`：增加 `MAX_DIMENSION = 1600` 等比縮放邏輯。
- **多語系翻譯檔案**：
  - `messages/zh-TW.json`
  - `messages/zh-CN.json`
  - `messages/en.json`

## 4. Non-goals (非本次目標)
- 不啟用 Next.js 伺服器端原生圖片最佳化模組（維持 `unoptimized: true`，避免 LiteSpeed/PM2 512MB-1536MB 環境 OOM 崩潰）。
- 不變更會員認證與 Turnstile 驗證機制。
- 不變更資料庫 Schema。

## 5. Acceptance Criteria (驗收標準)
- [ ] `/cart`、`/login`、`/register`、`/forgot-password` 輸出標準 `<title>`、`<meta name="description">`、`<meta name="robots">` 與 `<link rel="alternate" hreflang="...">`。
- [ ] `RegisterForm` 與 `ForgotPasswordForm` 為 Client Component，而對應 `page.tsx` 為 Server Component，保持動態 `generateMetadata` 支援。
- [ ] `SiteHeader` 頂部搜尋欄於 `/zh-CN/` 或 `/en/` 下提交時，跳轉至對應語系之 `/listings?q=...`。
- [ ] `LanguageSwitcher` 文字顏色符合 WCAG AA 對比標準（`text-neutral-700 hover:text-neutral-950`）。
- [ ] `NewsletterForm` 與社群連結按鈕皆具備完整 `aria-label` 與大於 40px 之觸控感應區。
- [ ] Microsoft Clarity 採用 `strategy="lazyOnload"`，不阻礙頁面初次渲染。
- [ ] 超過 1600px 之圖片於轉檔時自動縮放至最大邊 1600px 內。
- [ ] 隱私權政策、退款政策、使用條款及 GDPR 頁面無「台北市示範路」、「公司登記名稱」或「〔　〕」符號。
- [ ] 補齊 `pigeonShowcase.title` 與 `subtitle` 字典 key，消除生產端 `MISSING_MESSAGE` 錯誤。

## 6. Verification (驗證方式)
- **單元測試**：
  - 執行 `npm test` 877 項測試全數通過。
- **型別檢查**：
  - 執行 `npm run typecheck` 0 錯誤。
- **語法與風格檢查**：
  - 執行 `npm run lint` 0 錯誤。
- **生產建置**：
  - 執行 `npm run build` 成功。
- **部署冒煙測試與線上複測**：
  - PR 合併至 `master` 後自動觸發 `.github/workflows/deploy-ftps.yml`。
  - 遠端健康檢查成功（HTTP 200）。
  - 對 `https://xiangshuicn.cc/` 進行 PageSpeed Insights 複測與頁面審查。

## 7. Risks and Rollout (風險與發布)
- **相容性風險**：極低。所有修改皆維持既有介面契約與路由結構。
- **部署影響**：標準 FTPS + PM2 重啟流程。
- **回滾計畫**：若有非預期異常，可直接 revert commit 或由 GitHub Actions 手動重新部署上一版本。

## 8. Open Decisions (未決事項)
- 無。
