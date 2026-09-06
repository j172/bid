# SPEC: 拍品詳情頁鴿舍資訊展示與鴿舍專屬清單專區 (Loft Attribution & Storefront)

## 1. 背景與目標
使用者希望在拍品詳情頁（`/listings/[id]`）右側主要價格卡片的最頂部標明該鴿子所屬的「合作鴿舍」，並提供跳轉至該鴿舍專屬清單頁（`/listings?loft={loftId}`，例如 `https://xiangshuicn.cc/listings?loft=1`）的完整互動流程。
在鴿舍清單頁面中，除了列出該鴿舍的所有鴿子外，需提供「在售中（預設） / 已結標 / 全部」快速狀態切換，並展示專屬鴿舍品牌橫幅（包含照片、名稱、簡介、返回全部商品按鈕）與動態 SEO 標題。

## 2. 規格細節

### A. 拍品詳情頁 (`/listings/[id]`)
- **檔案**：`app/[locale]/listings/(no-loading)/[id]/page.tsx`
- **位置**：右側價格卡片（`rounded-2xl border border-border bg-white p-6 shadow-sm`）的最上方，位於「價格」二字之上。
- **展示內容**：
  - 若拍品綁定合作鴿舍（`listing.loft_id !== null`）：
    - 頂部精緻鴿舍列：左側為小圖示/頭像（`/uploads/sections/{imageFileName}`）與「合作鴿舍」小標籤，搭配**粗體鴿舍名稱**。
    - 右側附帶跳轉箭頭圖示（`text-interactive-primary`）。
    - 點擊可導航至 `/listings?loft={listing.loft_id}`。
    - 下方帶有一條細底線（`border-b border-border pb-4 mb-5`）與價格區優雅區隔。
  - 若未綁定合作鴿舍（`listing.loft_id === null`）：
    - 完全不渲染該區塊，保持價格卡片簡潔俐落。
- **規格表格連動**：
  - 在下方「規格與說明」表格（`ListingDetailTabs` 之 `specs`）中，當 `listing.loft_id` 存在時，同步加入一列「所屬鴿舍」，內容為可點擊前往該鴿舍清單的連結。

### B. 鴿舍專屬清單頁 (`/listings?loft={id}`)
- **檔案**：`app/[locale]/listings/(with-loading)/page.tsx`
- **品牌橫幅卡片**：
  - 當網址帶有 `loft` 參數時，查詢該鴿舍資訊（`homepage_sections`）。
  - 在頁面頂部展示「鴿舍品牌橫幅卡片」：包含鴿舍代表照片、名稱、簡介，以及「查看全部拍品 / 清除篩選」按鈕。
- **狀態切換標籤**：
  - 在橫幅下方提供「在售中 / 已結標 / 全部」狀態切換 Tabs：
    - 「在售中」（預設）：顯示 `open` 與 `scheduled` 的拍品。
    - 「已結標」：顯示 `status = 'closed'` 的歷史結標拍品。
    - 「全部」：顯示該鴿舍歷來所有拍品（包含在售中與已結標）。
- **已結標卡片呈現 (`ProductCard.tsx`)**：
  - 當拍品已結標時，狀態徽章顯示為中性灰階「已結標」標籤，避免與在售商品混淆。
  - 價格顯示為最終結標金額，資訊列顯示結標時間與出價筆數。
- **動態 SEO 與社群分享**：
  - 在 `generateMetadata` 中，當有 `loft` 參數時，動態帶入該鴿舍名稱與簡介至 `<title>` 與 OpenGraph（例如：`翔順鴿舍 - 拍賣與展售清單 | 香水賽鴿`）。

### C. 多語系 (i18n)
- 更新 `messages/zh-TW.json`, `messages/zh-CN.json`, `messages/en.json`：
  - `partnerLoft`: 合作鴿舍 / 合作鸽舍 / Partner Loft
  - `allPigeons`: 所有鴿子 / 所有鸽子 / All Pigeons
  - `statusActive`: 在售中 / 在售中 / Active
  - `statusClosed`: 已結標 / 已结标 / Closed
  - `statusAll`: 全部 / 全部 / All
  - `viewAllLofts`: 查看全部商品 / 查看全部商品 / View All Listings
  - `badgeClosed`: 已結標 / 已结标 / Closed

## 3. 驗證計劃
- `npm run typecheck`：TypeScript 0 錯誤。
- `npm test`：單元測試全部通過。
- `npm run build`：Next.js 編譯通過。
- 建立 Worktree，完成測試後合併至 master 並 push。
- 觸發 GitHub Actions 部署至正式站。
