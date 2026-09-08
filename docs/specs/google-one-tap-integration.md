# SPEC: 整合 Google One Tap 與 Google 一鍵登入

## 1. 背景與目標
為降低訪客進入門檻、提升會員註冊與登入轉換率，本專案將整合 Google Identity Services (GSI) 之 **Google One Tap** 與 **Sign in with Google** 按鈕。

本規格書完整實作經由團隊討論確認之決策架構：
1. **全站被動轉化 (Sitewide One Tap)**：訪客在全站未登入頁面皆會主動出現 One Tap 浮動提示。
2. **雙軌並行 (Dual-Track)**：除全站 One Tap 外，於 `/login` 與 `/register` 頁面提供顯式實體「使用 Google 帳號登入」按鈕作為 Fallback。
3. **極低摩擦自動註冊**：若系統中尚無該 Google Email 之帳號，系統自動建立會員並直接登入（`email_verified = 1`，電話與地址留空）。
4. **拍賣業務風控守護 (Bidding Guard)**：Google 註冊之無電話/地址會員可自由瀏覽，但在「出價競標（Bid）」或「直接購買（Buy It Now）」時強制阻擋（回傳 `PROFILE_INCOMPLETE`），引導補填資料以防惡意棄標。
5. **嚴格安全保護 (2FA Guard)**：若既有帳號已啟用 TOTP 或 Email OTP 雙重驗證，Google 驗證通過後仍須完成 2FA 挑戰方可取得登入 Session。
6. **無密碼帳號管理 (Passwordless Management)**：個人中心（`/account`）偵測無密碼帳號，提供「設定登入密碼」表單（免填舊密碼），設定後解鎖傳統帳密與 2FA 權限。
7. **登入後無縫動線**：在商品頁等瀏覽情境原地刷新頁面；在登入/註冊頁則導向目標頁或首頁。登出時呼叫 `disableAutoSelect()`。

---

## 2. 規格細節

### 2.1 資料庫層 (`db/init.sql` & `lib/db.ts`)
- `users` 資料表調整：
  - 新增 `google_id VARCHAR(255) NULL UNIQUE` 欄位（儲存 Google OIDC `sub`）。
  - 將 `password_hash` 與 `password_salt` 改為允許 `NULL`（支援純 Google / OAuth 註冊之無密碼帳號）。
- 在 `lib/db.ts` 實作自動遷移輔助函式 `ensureGoogleAuthColumns(db)`，啟動時確保欄位存在且型別正確。

### 2.2 後端驗證與認證層 (`app/api/auth/google/route.ts` & `lib/auth.ts`)
- 提供 `POST /api/auth/google`：
  - 接收 `{ credential: string }`（Google ID Token JWT）。
  - 驗證 Token 簽章、發行者（`accounts.google.com` 或 `https://accounts.google.com`）、受眾（`GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID`）與過期時間。
  - 檢驗 `email_verified === true`。
  - 身分對齊（Account Linking）：
    1. 依 `google_id` 查詢；若查無則依 `email` 查詢。
    2. 若找到既有會員，自動補綁 `google_id`。
    3. 若皆查無會員，自動建立新會員：
       - `email`: Google 提供之信箱（轉小寫）
       - `google_id`: Google `sub`
       - `display_name`: Google 提供之姓名（或 `userXXXXX`）
       - `email_verified`: 1
       - `phone`: NULL, `address`: NULL, `password_hash`: NULL, `password_salt`: NULL
       - `role`: 'user'（若符 `ADMIN_EMAIL` 則為 'admin'）
  - 停權檢查：若 `suspended_at !== null`，回傳 403 `ACCOUNT_SUSPENDED`。
  - 2FA 檢查：
    - 若 `two_factor_method === 'email_otp'`，建立發送 OTP 並回傳 `{ ok: true, twoFactorRequired: true, twoFactorMethod: 'email_otp', challengeToken }`。
    - 若 `two_factor_method === 'totp'`，回傳 `{ ok: true, twoFactorRequired: true, twoFactorMethod: 'totp', challengeToken }`。
  - 無 2FA 或驗證通過：呼叫 `createSession(userId)` 建立 Session Cookie 並回傳會員資訊。

### 2.3 拍賣競標風控攔截 (`lib/listings.ts` & `app/api/listings/[id]/bids/route.ts` & `buy-now`)
- 在 `placeBid` 與 `buyNow` 執行前，檢查該投標/購買會員之 `phone` 與 `address`。
- 若任一為空或空白，回傳 `{ ok: false, errorCode: "PROFILE_INCOMPLETE" }`。
- 前端出價與直購彈窗攔截此錯誤代碼，引導使用者至 `/account` 補填聯絡電話與寄送地址。

### 2.4 個人中心無密碼帳號管理 (`/account`)
- `getAccountProfile(userId)` 回傳 `hasPassword: boolean`（判斷 `password_hash IS NOT NULL`）。
- `ChangePasswordForm.tsx`：
  - 若 `hasPassword === false`，標題顯示「設定登入密碼」，僅需填寫新密碼與確認新密碼，免填舊密碼。
  - 後端 `setPassword(userId, newPassword)` 支援直接設定密碼，設定後 `hasPassword` 轉為 `true`。

### 2.5 前端 Google One Tap 與按鈕整合
- **環境變數**：
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`（前端載入 GSI 所需，非機密）。
  - 若未設定此環境變數，組件優雅降級不渲染，全站正常運作。
- **全站浮動提示 (`app/[locale]/components/GoogleOneTap.tsx`)**：
  - 於 `app/[locale]/layout.tsx` 中掛載（當前若為未登入狀態且有設定 Client ID 時渲染）。
  - 載入 `https://accounts.google.com/gsi/client?hl={locale}`。
  - 初始化 `google.accounts.id.initialize({ client_id, callback, auto_select: false })` 並呼叫 `prompt()`。
  - 登入成功後：若在商品頁等直接 `window.location.reload()`；若在登入/註冊頁則導向目標路徑。
- **實體按鈕 (`app/[locale]/components/GoogleSignInButton.tsx`)**：
  - 放置於 `/login` 與 `/register` 頁面（支援 Google 官方標準渲染樣式）。
- **登出保護 (`app/[locale]/components/Header.tsx` / 登出邏輯)**：
  - 點擊登出時呼叫 `window.google?.accounts?.id?.disableAutoSelect()`，避免無限循環自動登入。

### 2.6 多國語系 (i18n)
- 更新 `messages/zh-TW.json`, `messages/zh-CN.json`, `messages/en.json`，補齊 Google 登入、設定密碼、個資補填提示等文案。

---

## 3. 驗證計劃
- `npm test`：執行全部 Vitest 單元測試（涵蓋 Google 認證路由、2FA 攔截、無密碼設定、出價風控攔截）。
- `npm run typecheck`：TypeScript 型別檢查 0 錯誤。
- `npm run lint`：ESLint 0 錯誤。
- `npm run build`：Next.js Production Build 打包成功。
- 建立 PR 合併至 `master`，驗證 GitHub Actions 自動 FTPS 部署至生產環境。
