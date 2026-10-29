# SPEC: 整合 LINE Login v2.1 登入與兩階段註冊

## 1. 背景與目標
為提升台灣及亞洲市場使用者的轉換率、降低註冊門檻，本專案依據 LINE 官方 OAuth 2.0 / OpenID Connect 規格（[Issue Access Token](https://developers.line.biz/en/reference/line-login/#issue-access-token)），為本站競標系統導入 **LINE Login** 登入與註冊整合。

本規格書完整落實與團隊深入討論確認之決策架構：
1. **標準 OAuth 2.0 流程**：採用後端 Web 授權碼模式（Authorization Code Flow），經由 `https://access.line.me/oauth2/v2.1/authorize` 授權後跳轉回端點，並由後端向 `https://api.line.me/oauth2/v2.1/token` 換取 `access_token` 與 `id_token`。
2. **兩階段註冊（Two-Step Onboarding）**：
   - 已綁定 LINE 之用戶：一鍵直接登入。
   - 首次使用 LINE 授權之全新用戶：後端驗證身分後，將 LINE 身分資料以加密/簽名的 HttpOnly Cookie 暫存（效期 15 分鐘），並導向專屬補填頁面（`/{locale}/register/line`）。
3. **既有帳號衝突安全關聯（Account Linking Guard）**：
   - 若使用者在補填流程輸入（或 LINE 回傳）之 Email 已存在於本站資料庫，為防範帳號劫持，系統要求輸入該既有帳號原密碼，或發送 Email OTP 驗證碼；驗證通過後才完成 LINE 綁定並登入。
4. **精簡註冊免密碼**：
   - 預設帶入 LINE 暱稱；若 LINE 有提供 Email 視為已驗證，無提供則由使用者手動填寫並完成 Email 驗證。
   - 必填手機號碼與勾選拍賣條款（記錄 `terms_accepted_at`）。
   - 免設密碼（日後透過 LINE 一鍵登入，亦可至個人中心自行設定密碼）。
5. **會員中心管理（`/account`）**：
   - 個人帳號設定頁新增「LINE 帳號綁定 / 解除綁定」功能。
   - 解除綁定時進行防鎖死檢查（必須留有密碼登入或 Google 綁定，避免帳號遺失進入途徑）。
6. **2FA 政策**：
   - 信任 LINE 登入之安全防護層級，通過 LINE 授權成功後直接核發 Session 登入，略過本站 2FA 挑戰。
7. **按鈕規範與降級防護**：
   - 前端登入頁（`/login`）與註冊頁（`/register`）提供符合 LINE 官方規範（#06C755 官方綠色、標誌與文案）之按鈕。
   - 若環境未設定 `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET`，按鈕優雅隱藏，API 回傳清晰組態錯誤，不影響站台其餘功能。

---

## 2. 規格細節

### 2.1 資料庫層 (`db/init.sql` & `lib/db.ts`)
- `users` 資料表異動：
  - 新增 `line_user_id VARCHAR(255) NULL` 欄位與唯一索引 `uq_users_line_user_id (line_user_id)`。
  - 說明：現有 `users.line_id VARCHAR(20)` 為供買賣雙方聯絡之公開 Handle；`line_user_id` 則儲存 LINE Login 內部發行之使用者識別碼（`sub`，例如 `U[0-9a-f]{32}`）。
- 在 `lib/db.ts` 新增自動遷移函式 `ensureLineUserIdColumn(db)`，系統啟動時自動檢驗並新增欄位與索引。
- 於 `lib/auth.ts` 新增與修改認證輔助函式：
  - `findUserByLineUserId(lineUserId: string): Promise<CurrentUser | null>`
  - `linkLineUserId(userId: number, lineUserId: string): Promise<void>`
  - `unlinkLineUserId(userId: number): Promise<void>`
  - `createLineUser(options: { email: string; lineUserId: string; displayName?: string; phone: string; termsAccepted: boolean; locale: string }): Promise<CurrentUser>`

### 2.2 LINE 核心服務模組 (`lib/lineAuth.ts`)
- **組態管理**：
  - `getLineConfig()`：讀取 `LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET`、`LINE_CALLBACK_URL`（預設 `${SITE_URL}/api/auth/line/callback`）。
- **授權網址建構**：
  - `getLineAuthorizationUrl(state: string, scope: string = "profile openid email")`。
- **Token 交換**：
  - 呼叫 `POST https://api.line.me/oauth2/v2.1/token`
  - 傳入參數：`grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`
  - 取得 `access_token` 與 `id_token`。
- **ID Token 解析與驗證**：
  - 驗證 JWT 簽章（或透過 LINE Verify 端點 `POST https://api.line.me/oauth2/v2.1/verify`），確認 `iss=https://access.line.me`、`aud=LINE_CHANNEL_ID`、未過期。
  - 提取 `sub`、`name`、`picture`、`email`（若授權）。
- **Onboarding 暫存 Cookie 簽名機制**：
  - `createLineOnboardingCookie(data: { lineUserId: string; displayName?: string; email?: string }): string`（使用 `SESSION_SECRET` HMAC 簽署）。
  - `verifyLineOnboardingCookie(token: string): { lineUserId: string; displayName?: string; email?: string } | null`。
- **State 防 CSRF**：
  - 產生隨機 `state` 並以 Signed Cookie 儲存於瀏覽器，回調時嚴格比對。

### 2.3 API 路由端點設計
1. `GET /api/auth/line`：
   - 檢查環境組態，產生 `state`（含 `returnTo` 參數），寫入 `line_auth_state` HttpOnly Cookie。
   - 重定向至 LINE 官方授權頁。
2. `GET /api/auth/line/callback`：
   - 驗證 query `state` 與 Cookie 中一致。
   - 呼叫 `issueLineAccessToken(code)` 取得身分。
   - 查詢 `findUserByLineUserId(sub)`：
     - 若已綁定：調用 `createSession(user.id)`，清除 state cookie，重定向至目標頁面（`returnTo`）。
     - 若未綁定：
       - 若 LINE 有帶 email 且該 email 已存在帳號：可直接在 Onboarding Cookie 註記 `emailExists: true`，導向補填頁由使用者驗證密碼/OTP 綁定。
       - 寫入 `line_onboard_token` HttpOnly Cookie（效期 15 分鐘），重定向至 `/{locale}/register/line`。
3. `POST /api/auth/line/complete-registration`：
   - 讀取並驗證 `line_onboard_token` Cookie。
   - 接收補填表單：`displayName`, `phone`, `email`, `emailOtpToken`, `termsAccepted`, `locale`。
   - 若 Email 為使用者手動輸入，驗證 Email OTP；檢查 Email 是否已被占用。
   - 呼叫 `createLineUser(...)` 建立會員，`createSession`，清除暫存 Cookie，回傳 `{ ok: true }`。
4. `POST /api/auth/line/link-existing`：
   - 接收 `email`, `password` 或 `emailOtpToken`。
   - 驗證成功後呼叫 `linkLineUserId(user.id, lineUserId)`，建立 Session 並清除暫存 Cookie。
5. `POST /api/auth/line/unlink`：
   - 會員中心解除綁定，先檢查該帳號是否有密碼或已綁 Google，防範無登入管道。

### 2.4 前端介面與多語系
1. **按鈕組件 (`app/[locale]/components/LineSignInButton.tsx`)**：
   - 符合 LINE Login 綠色規範 (`#06C755`)，提供 LINE 官方 SVG 圖示。
   - 放置於 `LoginForm.tsx` 與 `RegisterForm.tsx`。
2. **LINE 專屬註冊補填頁 (`app/[locale]/register/line/page.tsx`)**：
   - 精簡友善 UI，帶入 LINE 暱稱。
   - 手機號碼輸入框、拍賣條款核取方塊。
   - 若 LINE 未給 Email，提供 Email 欄位及發送/驗證 Email OTP 功能。
   - 若偵測到既有帳號，切換為「驗證密碼或信箱綁定」面板。
3. **會員中心 LINE 綁定區塊 (`app/[locale]/account/LineSection.tsx`)**：
   - 於 `/account` 頁面顯示 LINE 綁定狀態。
   - 未綁定時顯示「綁定 LINE 帳號」按鈕；已綁定時顯示「解除綁定」按鈕與安全提醒。
4. **多語系檔擴充**：
   - 在 `messages/zh-TW.json`, `messages/zh-CN.json`, `messages/en.json` 補齊 LINE 登入相關文案。

---

## 3. 環境變數設定需求
若要正式啟用 LINE Login，系統管理員需於 `.env` 中加入下列變數：
- `LINE_CHANNEL_ID`: LINE Developers Console 中建立的 LINE Login Channel ID。
- `LINE_CHANNEL_SECRET`: LINE Login Channel 的 Channel secret。
- `LINE_CALLBACK_URL`（選填）：自訂回調完整網址，未設定時自動採用 `${SITE_URL}/api/auth/line/callback`。

在 LINE Developers 後台需設定：
- **Callback URL**: `https://<DOMAIN>/api/auth/line/callback`（本機開發時可加入 `http://localhost:3000/api/auth/line/callback`）。
- **Scopes**: 啟用 `profile`, `openid`，並視需要申請 `email` 權限。

---

## 4. 驗證計劃
- **單元測試**：
  - `lib/lineAuth.test.ts`：測試 Token 交換模擬、ID Token 解析校驗、Onboarding Cookie 簽署與防篡改、State CSRF 檢驗。
  - `lib/auth.test.ts`：測試 `findUserByLineUserId`、`linkLineUserId`、`unlinkLineUserId`、`createLineUser`。
- **整合測試**：
  - `app/api/auth/line/route.test.ts`、`callback/route.test.ts`、`complete-registration/route.test.ts`。
- **全站品質把關**：
  - `npm test`：所有 Vitest 測試皆通過。
  - `npm run typecheck`：TypeScript 0 錯誤。
  - `npm run lint`：ESLint 0 錯誤。
  - `npm run build`：Production Build 成功打包。
