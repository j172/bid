# SPEC: 社群動態區塊升級官方 IFRAME 與 Creator Profile 嵌入

## 1. Outcome
訪客進入首頁社群專區時，能直接瀏覽「翔水鴿舍」官方 Facebook 最新貼文動態時間軸，以及「翔水賽鴿」官方 TikTok 創作者短影音專區，以官方標準嵌入呈現真實互動與最新動態，同時保持首頁載入速度（Core Web Vitals）與視覺美觀。

## 2. Scope
- **UI 組件**：`app/[locale]/components/SocialMediaSection.tsx`
  - 實作 Facebook 官方品牌互動名片卡：鑑於 Meta 官方 `plugins/page.php` 僅支援「公開粉絲專頁（Page）」，而 `xiang.shui.ge.she` 為個人檔案（User Profile）會回傳空白內容，故升級為官方品牌互動名片卡，完整露出頭像、品牌標章、舍內動態介紹與直通 Facebook 的互動按鈕。
  - 引入 TikTok 官方 Creator Profile 嵌入（`blockquote` + `embed.js`，展示官方創作者名片與最新短影音）。
  - 實作版面分流：上方維持 YouTube 16:9 賽鴿影音網格，下方左右雙欄呈現 Facebook 與 TikTok 官方即時動態牆。
  - 實作智慧聯動 Tab 切換（全部 / YouTube / Facebook / TikTok）。
  - 實作 Intersection Observer 滾動延遲載入（Lazy Loading）與防跳動骨架佔位。
- **多語系 (i18n)**：`messages/zh-TW.json`, `messages/zh-CN.json`, `messages/en.json`
  - 新增即時社群動態牆對應鍵值（`liveFeedsTitle`, `liveFeedsSubtitle`, `goToFacebook`, `goToTiktok`）。
- **自動化測試**：`app/[locale]/components/SocialMediaSection.test.tsx`
  - 覆蓋 Facebook Page Plugin IFRAME 與 TikTok Creator Embed 屬性驗證及 Tab 篩選互動。

## 3. Non-goals
- 不使用第三方付費或未經官方授權的社群聚合爬蟲服務（如 Elfsight、Curator.io）。
- 不更動 YouTube RSS / 快取資料層結構（`lib/socialMedia.ts`）。
- 不直接使用禁止的純 `<iframe src="https://www.tiktok.com/@user...">` 造成 CSP 破圖。

## 4. Acceptance criteria
- [ ] 首頁社群專區「全部精選」標籤下，上方顯示 YouTube 影片卡片，下方並排顯示 Facebook 貼文時間軸與 TikTok 創作者動態。
- [ ] Facebook 嵌入採用官方 Page Plugin IFRAME，具備 `loading="lazy"` 與適應寬度。
- [ ] TikTok 嵌入採用官方 Creator Profile 規格，並透過非同步腳本安全渲染。
- [ ] 切換至「Facebook」或「TikTok」分頁時，該平台動態牆單獨置中舒適呈現。
- [ ] 未捲動到社群區塊時，不向社群平台發送非必要請求，保護首頁載入效能。
- [ ] 現有 YouTube 燈箱播放器與頂部社群追蹤連結功能正常。
- [ ] 所有單元測試、型別檢查與程式碼規範全數通過。

## 5. Risks & Rollout
- **風險**：第三方社群平台服務可能因使用者網路環境或廣告攔截外掛（Ad blocker）封鎖。
- **因應與回滾**：嵌入框均設有乾淨後備提示與直接連至社群首頁之文字超連結；若需回滾，直接 revert PR 即可。

## 6. Verification
- `npx vitest run app/[locale]/components/SocialMediaSection.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
