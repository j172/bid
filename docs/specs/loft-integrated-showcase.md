# Spec: 合作鴿舍專頁全面整合交易商品與舍內名鴿展示

## 背景與問題陳述
使用者在訪問合作鴿舍專頁（如 `/listings?loft=1`，翔水鴿舍）時回報：
「沒有列出該鴿舍的所有鴿子，結果為空。」

經過環境事實查證：
1. **拍賣商品庫存狀態**：
   翔水鴿舍（`loft_id = 1`）在 `listings` 資料庫中共有 2 筆拍品（`超級446`、`超級416`），但這兩筆的狀態皆為「已結標（`closed`）」。原本 `/listings?loft=1` 在未帶 `status` 參數時，預設過濾 `status IN ('open', 'scheduled')`（在售中），因此查詢結果為 0 件商品，顯示空態「目前沒有開放中的商品。」
2. **跨專區名鴿展示存在**：
   翔水鴿舍另有舍內名鴿登錄在 `pigeon_showcase` 資料庫（入賞鴿 `拉普麒麟號Rap Meewke`，ID 15）。過去該資料僅出現在獨立的 `/pigeon-showcase`，未整合於鴿舍專頁中。

## 解決方案規範

### 1. 統一旗艦鴿舍專頁定位 (`/listings?loft={id}`)
將 `/listings?loft={id}` 提升為該合作鴿舍的「官方旗艦專頁」，完整整合同一鴿舍的兩大核心資產：
1. **交易商品（Listings）**：競標商品與定價種鴿（含在售中與歷史結標）。
2. **舍內名鴿（Pigeon Showcase）**：入賞鴿、進口鴿與代表種鴿。

### 2. 雙大分頁（Tabs）架構
在鴿舍標頭（Loft Hero Banner）中提供頂部大分頁切換：
- **【交易商品 (N)】**（預設，`?tab=listings` 或無參數）：
  - **智慧狀態預設**：當 URL 指定特定鴿舍（`loft` 參數存在）且未指定 `status` 參數時，交易商品預設範圍自動改為 `statusScope: "all"`（全部，包含在售中與已結標），避免鴿舍拍賣結束時呈現空頁面。翔水鴿舍的 2 筆結標拍品立即展示。
  - 保留狀態按鈕：`在售中`、`已結標`、`全部`。
  - 保留類型、分類篩選與價格排序。
- **【舍內名鴿 (N)】**（`?tab=showcase`）：
  - 切換至全寬名鑑網格佈局（Full-width Showcase Grid），隱藏與名鑑不相符的電商側邊欄。
  - 頂部提供名鑑子類別頁籤切換：
    - `全部 ({totalCount})`
    - `入賞鴿 ({awardCount})`
    - `進口鴿 ({importedCount})`
    - `代表種鴿 ({representativeCount})`
  - 卡片呈現名鴿圖片、名鑑分類徽章、鴿名、羽色血統描述摘要、及「查看鴿況」連結至 `/pigeon-showcase/[id]`。
  - 若名鴿為空，提供精美的空態說明。

### 3. 全站動線統一
在名鴿詳情頁（`app/[locale]/(no-loading)/pigeon-showcase/[id]/page.tsx`）：
- 將鴿舍連結改為導航至 `/listings?loft={item.loftId}&tab=showcase`，形成順暢的閉環體驗。

### 4. 國際化與 SEO
- 新增 `tabLoftListings`、`tabLoftShowcase`、`loftShowcaseEmpty`、`allCategories` 等多語系文案（zh-TW, zh-CN, en）。
- 當 `tab=showcase` 時，`generateMetadata` 動態調整頁面標題為「{鴿舍名稱} - 舍內名鴿名鑑 | 翔水賽鴿網」。
