# SPEC: 整合社群媒體 (Facebook, YouTube, TikTok) 並於首頁與頁尾露出內容

## 1. 背景與目標
整合翔水賽鴿三大官方社群媒體：
- Facebook: `https://www.facebook.com/xiang.shui.ge.she/`
- YouTube: `https://www.youtube.com/@tara-789-l5z` (Channel ID: `UCfgN6N-8LVPfYJqXBZ_4M_g`)
- TikTok: `https://www.tiktok.com/@user2151480077563`

於首頁建立「官方社群影音動態專區」，呈現最新 YouTube 影音、Facebook 動態與 TikTok 短影音；並於全站頁尾（SiteFooter）替換假連結為真實品牌圖示與官方連結。

## 2. 規格細節
- **資料層 (`lib/socialMedia.ts`)**：
  - 定義官方社群常數：Facebook, YouTube, TikTok 連結。
  - 提供 `getSocialMediaFeed()`：
    - 抓取 YouTube 公開 RSS (`https://www.youtube.com/feeds/videos.xml?channel_id=UCfgN6N-8LVPfYJqXBZ_4M_g`) 取得最新影片。
    - 結合 Facebook 與 TikTok 官方精選動態卡片。
    - 實作伺服器端短暫快取（例如 5~15 分鐘）與防禦性 fallback，確保外部網路中斷時頁面永不報錯。
- **首頁社群專區 (`app/[locale]/components/SocialMediaSection.tsx`)**：
  - 放置於首頁「最新新聞公告」下方與「氣象圖」上方。
  - 頂部：標題、副標題、以及直連三大平台的「關注/訂閱」按鈕。
  - 分頁標籤（Tabs）：全部精選 / YouTube 影音 / Facebook 動態 / TikTok 短影音。
  - 卡片呈現：平台標籤（Badge）、封面縮圖、標題、發布時間、播放按鈕微動效。
  - 效能守護（Facade / Lazy Load）：點擊卡片時原地或於 Modal 視窗流暢播放影音，不預先載入龐大 SDK，保證 Core Web Vitals 與 PageSpeed 高分。
- **頁尾社群連結 (`app/[locale]/components/SiteFooter.tsx`)**：
  - 將既有佔位文字（`FB / X / IG / IN`）替換為 Facebook、YouTube、TikTok 官方高質感向量 SVG 圖示與正確超連結。
- **多語系 (i18n)**：
  - `messages/zh-TW.json`, `messages/zh-CN.json`, `messages/en.json` 新增 `socialMedia` 鍵值。
- **自動化測試**：
  - `lib/socialMedia.test.ts`
  - `app/[locale]/components/SocialMediaSection.test.tsx`

## 3. 驗證計劃
- `npm test`：所有 Vitest 單元測試通過。
- `npx tsc --noEmit`：TypeScript 型別檢查 0 錯誤。
- `npm run lint`：ESLint 0 錯誤。
- `npx next build`：99/99 路由順利打包通過。
- PR 合併至 `master`，觸發 GitHub Actions 部署至正式機。
- 線上實測首頁與頁尾社群露出。
