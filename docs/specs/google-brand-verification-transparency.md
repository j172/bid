# SPEC: Google 品牌驗證透明度與首頁應用程式說明 (Google Brand Verification Transparency & App Purpose)

## 1. 背景與目標 (Background & Outcome)

### 背景
翔水賽鴿網（`https://xiangshuicn.cc`）在進行 Google Cloud Platform (GCP) OAuth 同意畫面品牌驗證（Brand Verification）時，遭到 Google 審查退件，列出以下三項問題：
1. **「您的首頁必須登入才能瀏覽。請更新首頁，讓使用者不必登入即可查看應用程式資訊。」**
2. **「首頁未說明應用程式用途。請在首頁中說明應用程式用途。」**
3. **「為 OAuth 同意畫面設定的應用程式名稱「xiangshui_Google_API」與首頁中顯示的不同。為應用程式設定符合現況的正確名稱。」**

### 目標
- 在網站首頁（`/`）加入明確、顯著、美觀且響應式的「平台服務與應用程式說明」區塊，向所有匿名訪客與審查員公開揭露：
  1. 應用程式名稱：翔水賽鴿網（Xiangshui Racing Pigeon Network）
  2. 平台核心功能與用途（賽鴿線上競標、固定價種鴿供應、名門血統名鑑、名舍專區與鴿訊發布）
  3. 免登入公開瀏覽聲明：所有拍品、起標價、出價歷程、名鑑資訊均公開開放，無需事先註冊或登入
  4. Google 帳號登入之用途與範圍：僅在參與出價競標、自動出價或下單時提供快速驗證，僅讀取 basic profile（name, email, picture），絕無敏感權限
  5. 隱私權保護與 Limited Use 聲明，並提供直達隱私權政策與服務條款之連結
- 在隱私權政策（`/privacy`）中增訂「Google 帳號登入與 API 資料使用規範（Limited Use 聲明）」，符合 Google API Services User Data Policy 要求。
- 全站提供正體中文（zh-TW）、簡體中文（zh-CN）與英文（en）三語支援。

## 2. 規格細節 (Specification)

### 2.1 首頁應用程式說明區塊 (`app/[locale]/(with-loading)/page.tsx`)
- 掛載於首頁信任評價區塊後、快速導覽區塊前（`<section id="about-platform">`）。
- 包含頂部標題、膠囊標籤（「全站公開 · 無需登入即可瀏覽」、「Google 安全登入 · 僅限出價與訂單」）。
- 4 張說明卡片（免登入公開瀏覽、專業即時競標、Google 帳號登入用途、隱私權與安全承諾）。
- 底部附註與法規連結（`/privacy` 與 `/terms`）。

### 2.2 隱私權政策增補 (`messages/*.json` -> `privacyPage`)
- 增設 Section 10：「Google 帳號登入與 API 使用者資料政策（Limited Use 聲明）」，明確載明：
  - 本站使用 Google OAuth 2.0 / Google One Tap 僅獲取基本資料（openid, email, profile）。
  - 資料僅用於身分驗證與交易通知，不轉作廣告或第三方販售。
  - 符合 Google API Services User Data Policy 及其 Limited Use 要求。

### 2.3 多語系對照 (`messages/*.json`)
- `messages/zh-TW.json`: 繁體中文
- `messages/zh-CN.json`: 簡體中文
- `messages/en.json`: 英文（提供 Google 審查員直接核驗）

## 3. 非目標 (Non-goals)
- 不變更現有 Google OAuth 登入驗證 API 路由（`app/api/auth/google/route.ts`）。
- 不調整既有 GoogleOneTap 元件之交互機制。
- 不更動資料庫架構與既有拍賣業務邏輯。

## 4. 驗收標準 (Acceptance Criteria)
- [ ] 首頁在未登入狀態下，滾動可見完整「平台服務與應用程式說明」區塊。
- [ ] 區塊內清楚標示品牌名稱「翔水賽鴿網 (Xiangshui Racing Pigeon Network)」。
- [ ] 區塊內明確載明公開免登入瀏覽、平台用途、Google 登入之目的與權限範圍。
- [ ] 隱私權政策頁（`/privacy`）包含 Google API Limited Use 政策合規說明。
- [ ] 正體中文、簡體中文與英文三語系切換正常，無漏失譯文 key。
- [ ] 所有單元測試與型別檢查均通過。

## 5. 驗證計劃 (Verification)
- `npm run typecheck`: 0 錯誤
- `npm run lint`: 0 錯誤
- `npm test`: 全數通過
- `npm run build`: 驗證 Next.js 生產建置
