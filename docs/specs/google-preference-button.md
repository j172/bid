# SPEC: Google 首選來源按鈕 (Google Preferences Button)

## 1. 背景與目標
使用者希望在標的詳情頁（`/listings/[id]`）以及新聞詳情頁（`/news/[id]`）加入「加入Google首選」按鈕。
點擊後前往 Google 首選來源設定頁（`https://www.google.com/preferences/source?q=xiangshuicn.cc`），引導讀者將本站設為首選來源，並提供優雅的視覺外觀、Tooltip 說明與完整的多語系支援。

## 2. 規格細節
- **按鈕元件**：`app/[locale]/components/GooglePreferenceButton.tsx`
- **目標連結**：`https://www.google.com/preferences/source?q=xiangshuicn.cc`
- **屬性**：`target="_blank" rel="noopener noreferrer"`
- **SVG 圖示**：標準 Google 4 色向量圖示（黃、紅、綠、藍）。
- **樣式與動效**：
  - Class 名稱相容 `.gsButton`、`.gsBtnIcon`、`.gsBtnText`，搭配 Tailwind CSS 實作精緻膠囊圓角（Pill shape）、微邊框、陰影與懸浮 hover 動效。
  - 氣泡 Tooltip：支援懸浮與鍵盤 focus 時淡入顯示提示文字，並帶向下指示箭頭。
  - 同步提供 HTML `title` 與 `aria-label` 屬性，兼顧無障礙與行動端相容。
- **多語系 (i18n)**：
  - 在 `messages/zh-TW.json`、`messages/zh-CN.json`、`messages/en.json` 加入 `googlePreference` 鍵值：
    - `zh-TW`: `buttonText`: "加入Google首選", `tooltip`: "請點選打勾將響水拍賣設為首選來源，在 Google 上查看更多精彩標的與報導"
    - `zh-CN`: `buttonText`: "加入Google首选", `tooltip`: "请勾选将响水拍卖设为首选来源，在 Google 上查看更多精彩标的与报道"
    - `en`: `buttonText`: "Add to Google Preferred", `tooltip`: "Click check to set Xiangshui Auction as a preferred source and see more stories on Google"
- **掛載位置**：
  1. `app/[locale]/listings/(no-loading)/[id]/page.tsx`：標題卡片區右側/上方。
  2. `app/[locale]/(no-loading)/news/[id]/page.tsx`：文章標題與發布時間旁。
- **測試**：
  - `app/[locale]/components/GooglePreferenceButton.test.tsx`：測試按鈕渲染、目標 URL、i18n 文字、無障礙屬性。

## 3. 驗證計劃
- `npm test`：所有 Vitest 單元測試通過。
- `npx tsc --noEmit`：TypeScript 型別檢查 0 錯誤。
- `npm run lint`：ESLint 0 錯誤。
- `npx next build`：Next.js 編譯通過。
- PR 合併至 `master` 後觸發 GitHub Actions 部署至正式機。
- 線上實測驗證。
