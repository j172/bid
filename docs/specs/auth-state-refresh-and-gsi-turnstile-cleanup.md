# 規格：登入／登出後前端認證狀態即時同步與 Google GSI／Cloudflare Turnstile 主控台錯誤修復（Issue #373）

## 1. 背景與目標（預期成果）

### 現況痛點
1. **登入與登出後頂部導覽列認證狀態未更新**：
   - Issue #354 將 `app/[locale]/layout.tsx` 與 `SiteHeader.tsx` 的認證狀態讀取改為客戶端 `CurrentUserProvider`（掛載於 `[locale]/layout.tsx`），僅在初次 mount 時呼叫一次 `GET /api/auth/me`。
   - 當使用者透過密碼、TOTP、Email OTP、Passkey、Google 登入、LINE 初次註冊／綁定登入或點擊 `LogoutButton` 登出時，頁面以 `router.push("/")` 與 `router.refresh()` 進行客戶端導航，`[locale]/layout.tsx` 中的 `CurrentUserProvider` 不會重新 mount，因此不會重新請求 `/api/auth/me`。結果登入後導覽列仍顯示「登入／註冊」，登出後仍顯示「會員中心／登出」，必須手動重新整理整頁才會更新。
2. **`/login` 與 `/register` 頁面 Google GSI 重複初始化與按鈕寬度錯誤**：
   - 全站 `GoogleOneTap` 與頁面內的 `GoogleSignInButton` 在 `/login` 及 `/register` 同時執行 `google.accounts.id.initialize()`，觸發 `[GSI_LOGGER]: google.accounts.id.initialize() is called multiple times.` 與 FedCM `NetworkError: Error retrieving a token.`。
   - `GoogleSignInButton` 呼叫 `renderButton` 時傳入 `width: "100%"`，但 Google Identity Services 僅接受整數像素寬度（200–400），導致主控台報錯 `[GSI_LOGGER]: Provided button width is invalid: 100%`。
   - `GoogleSignInButton` 原先仰賴 `GoogleOneTap` 載入 GSI script，若在 `/login`、`/register` 停用 `GoogleOneTap`，`GoogleSignInButton` 需自行載入 GSI script。
3. **Cloudflare Turnstile 在路由切換卸載時殘留 Widget**：
   - `TurnstileWidget` 載入 `https://challenges.cloudflare.com/turnstile/v0/api.js` 未指定 `?render=explicit`，且在元件 unmount 時未呼叫 `window.turnstile.remove(widgetId)`，導致登入成功跳轉首頁後 Turnstile 內部背景重試找不到已卸載的容器，報錯 `[Cloudflare Turnstile] Cannot find Widget ...`。

### 預期成果
1. **登入／登出後導覽列狀態立即同步**：`CurrentUserProvider` 提供 `refresh()` 方法並使用 `fetch("/api/auth/me", { cache: "no-store" })`，所有登入與登出成功路徑皆呼叫 `refresh()`，無須手動重新整理瀏覽器即可立即反映最新登入狀態。
2. **消除 Google GSI 主控台錯誤**：
   - `GoogleOneTap` 在 `/login` 與 `/register` 路由不初始化亦不渲染 One Tap prompt。
   - `GoogleSignInButton` 自行載入 GSI script，並以容器實際像素寬度（限制於 `200` 至 `400` 之間的整數）傳入 `renderButton`。
3. **消除 Cloudflare Turnstile 卸載後主控台錯誤**：`TurnstileWidget` 使用 `?render=explicit` 載入腳本，並在 `useEffect` cleanup 中安全呼叫 `window.turnstile.remove(widgetId)`。

---

## 2. 範圍

- `app/[locale]/components/CurrentUserProvider.tsx`：
  - 在 `CurrentUserState` 與 `CurrentUserContext` 新增 `refresh: () => void`（預設值為 no-op `() => {}`），並於 `fetch("/api/auth/me", { cache: "no-store" })` 停用快取。
- 登入與登出元件串接 `useCurrentUser().refresh()`：
  - `app/[locale]/login/LoginForm.tsx`
  - `app/[locale]/login/TotpStep.tsx`
  - `app/[locale]/login/EmailOtpStep.tsx`
  - `app/[locale]/login/PasskeyLoginButton.tsx`
  - `app/[locale]/components/GoogleSignInButton.tsx`
  - `app/[locale]/register/line/LineRegisterForm.tsx`
  - `app/[locale]/components/LogoutButton.tsx`
- `app/[locale]/components/CurrentUserProvider.test.tsx`：
  - 新增單元測試驗證呼叫 `refresh()` 會重新請求 `/api/auth/me` 並將 `user` 由 `null` 更新為已登入使用者（以及由已登入更新為 `null`）。
- `app/[locale]/components/GoogleOneTap.tsx`：
  - 當 `pathname === "/login" || pathname === "/register"` 時不進行初始化並提早回傳 `null`。
- `app/[locale]/components/GoogleSignInButton.tsx`：
  - 自行渲染 `<Script src={`https://accounts.google.com/gsi/client?hl=${locale}`} strategy="afterInteractive" />`。
  - 計算容器像素寬度 `Math.min(400, Math.max(200, Math.floor(containerRef.current.getBoundingClientRect().width) || 360))` 並傳入 `renderButton` 的 `width`。
- `app/components/TurnstileWidget.tsx`：
  - 為 `Window["turnstile"]` 型別補上 `remove?: (widgetId: string) => void`。
  - 將 `<Script>` 的 `src` 改為 `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`。
  - 於 `useEffect` cleanup 中呼叫 `window.turnstile.remove(widgetIdRef.current)`（包在 `try/catch` 中）並重設 `widgetIdRef.current = null`。

---

## 3. 非目標

- 不變更後端 `/api/auth/*` 各端點的 session 與回應契約。
- 不將 `app/[locale]/layout.tsx` 改回伺服器端動態渲染（維持 SSG 相容架構）。

---

## 4. 驗收標準

- [x] `CurrentUserContext` 暴露 `refresh: () => void`（預設 no-op `() => {}`），且 `CurrentUserProvider` 使用 `fetch("/api/auth/me", { cache: "no-store" })`。
- [x] `LoginForm`、`TotpStep`、`EmailOtpStep`、`PasskeyLoginButton`、`GoogleSignInButton`、`LineRegisterForm`、`LogoutButton` 在登入或登出成功時皆呼叫 `refresh()`。
- [x] `CurrentUserProvider.test.tsx` 包含驗證 `refresh()` 能將 `user` 從 `null` 更新為登入使用者及反向更新的測試案例。
- [x] `GoogleOneTap.tsx` 在 `/login` 與 `/register` 路由不執行 `initGsi` 且回傳 `null`。
- [x] `GoogleSignInButton.tsx` 載入 GSI `<Script>` 並傳遞 `200`–`400` 之間的整數像素寬度給 `renderButton`。
- [x] `TurnstileWidget.tsx` 使用 `?render=explicit` 並在卸载時透過 `window.turnstile?.remove` 清除 widget。
- [x] 通過相關單元測試、`npm run typecheck` 與 `npm run lint`。

---

## 5. 風險與復原

- **風險評估**：
  - `CurrentUserContext` 預設 `refresh: () => {}` 為無副作用的 no-op，現有未包裹 `CurrentUserProvider` 的元件單元測試（如 `LineRegisterForm.test.tsx`）不需額外 mock 即可正常運作。
  - `GoogleOneTap` 在 `/login` 與 `/register` 停用後，這兩個頁面的 Google 登入由頁面上的 `GoogleSignInButton` 獨立載入 GSI script 並負責初始化，避免雙重 `initialize()` 衝突。
- **復原計畫**：
  - 若部署後發現異常，可單獨 `git revert` 本次 commit 並重新部署。

---

## 6. 驗證計畫

1. 單元測試：執行 `CurrentUserProvider.test.tsx` 與 `LineRegisterForm.test.tsx`。
2. 靜態檢查：執行 `npm run typecheck` 與 `npm run lint`。
