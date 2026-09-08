# SPEC: 全站頂部導覽列所有分類 Popover 下拉選單 (Category Popover Dropdown)

## 1. 背景與目標 (Outcome)
目前全站頂部導覽列 [SiteHeader.tsx](file:///d:/GoogleDrive/bid/app/[locale]/components/SiteHeader.tsx#L114-L117) 內存在一顆視覺上為漸層膠囊外觀的「所有分類 ▾」按鈕：
```html
<button type="button" class="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-steel-azure-500 to-steel-azure-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm">
  所有分類<span aria-hidden="true">▾</span>
</button>
```
此按鈕目前為純靜態元素（無點擊行為、無展開內容，且僅在桌面版 `lg:flex` 顯示）。
本規格旨在將該按鈕升級為**全站分類導覽型下拉選單（Category Popover）**，提供桌面版 3 欄式複合型導覽（交易專區、舍內名鴿名鑑、精選合作鴿舍）與平滑動畫、Click-outside、Esc 鍵關閉及鍵盤無障礙支援；同時將分類導覽結構同步整合至行動版選單中，使全站使用者皆能便捷探索各核心業務板塊。

---

## 2. 範圍與非目標 (Scope & Non-goals)

### Scope
- **新增客戶端微組件**：`app/[locale]/components/CategoryDropdown.tsx`
  - 封裝 Popover 開合狀態、點擊外部自動關閉、鍵盤 Esc 關閉與無障礙屬性（`aria-expanded`, `aria-haspopup`）。
  - 箭頭圖示 `▾` 伴隨開合提供 180 度平滑旋轉動畫。
  - 3 欄式卡片佈局（寬度約 680px），具備精緻陰影與圓角。
- **修改 Header 伺服端組件**：`app/[locale]/components/SiteHeader.tsx`
  - 在 Server 端查詢啟用中的合作名舍（`listHomepageSections("partner_loft")`，最多 6 家），透過 Props 傳入 `CategoryDropdown`。
  - 在行動版 `<details class="relative lg:hidden">` 漢堡選單內整合分類導覽列表，兼顧窄螢幕體驗。
- **多語系支援**：`messages/zh-TW.json`, `messages/zh-CN.json`, `messages/en.json`
  - 在 `nav` 字典下補充各分區標題與子項目翻譯鍵值。
- **單元測試**：`app/[locale]/components/CategoryDropdown.test.tsx`
  - 驗證按鈕渲染、點擊開合、Esc 關閉、Click outside 及導覽連結正確性。

### Non-goals
- 不更動右側搜尋列內部現有的 `<select name="type">` 搜尋類型選擇機制。
- 不引入重型第三方 UI 庫（如 Headless UI 或 Radix），維持純 React + Tailwind CSS 的輕量依賴。
- 不更動資料庫 Schema。

---

## 3. 欄位架構與內容規劃 (Content Architecture)

### 3 欄式複合選單架構：
1. **第 1 欄【拍賣與交易專區】**
   - 競標拍賣：`/listings?type=auction`
   - 定價種鴿：`/listings?type=fixed_price`
   - 即將結標：`/listings?type=auction&sort=ends_soon&withinHours=6`
   - 全部拍品：`/listings`
2. **第 2 欄【舍內名鴿名鑑】**
   - 入賞鴿名鑑：`/pigeon-showcase?category=award`
   - 進口鴿名鑑：`/pigeon-showcase?category=imported`
   - 代表種鴿名鑑：`/pigeon-showcase?category=representative`
   - 探索全部名鴿：`/pigeon-showcase`
3. **第 3 欄【精選合作鴿舍】**
   - 動態列出已啟用名舍（如：翔水鴿舍、荷蘭名舍等，連結至 `/listings?loft={id}`）
   - 查看全部合作鴿舍捷徑
   - 查無資料時顯示優雅空態

---

## 4. 驗收標準 (Acceptance Criteria)
- [ ] 桌面版點擊「所有分類 ▾」按鈕能流暢展開／收合 3 欄式導覽面板。
- [ ] 面板展開時，箭頭圖示旋轉 180 度；點擊選單外部或按下 `Esc` 鍵能正確關閉選單。
- [ ] 點擊選單內的任一連結後，選單自動收合並正確導航至目標 URL。
- [ ] 面板具備 `aria-expanded` 與 `aria-haspopup="menu"` 等無障礙屬性。
- [ ] 合作名舍由伺服端傳入，即使無合作名舍也不報錯崩潰。
- [ ] 行動版選單整合分類導覽，不破壞既有版面。
- [ ] zh-TW, zh-CN, en 三種語系均具備完整翻譯。
- [ ] `npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 全數通過。

---

## 5. 風險與部署 (Risks & Rollout)
- **風險**：無資料庫異動，無 breaking change，純前端介面與路由導覽優化，風險低。
- **部署**：PR 合併至 `master` 後自動觸發 `.github/workflows/deploy-ftps.yml`，經由 FTPS 上傳並通過線上 health check。
- **回滾**：若發生異常，可直接 revert PR 或手動重跑前次成功之 CI 工作流程。
