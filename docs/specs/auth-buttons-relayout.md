# SPEC: 登入與註冊頁面快捷驗證按鈕置頂重構 (Auth Buttons Relayout)

## 1. 背景與目標
為降低使用者登入與註冊阻力、提供台灣與全球用戶更直覺的快速驗證動線，將現有登入與註冊表單下方之第三方與免密驗證按鈕移至卡片最頂部（標題正下方、傳統表單正上方）。

本規格書依據 GRILL ME 訪談決策確認以下核心原則：
1. **雙頁同步 (Scope)**：登入頁（`/login`）與註冊頁（`/register`）同步重構版面，維持全站一致之快速驗證優先體驗。
2. **頂部排列順序 (Order)**：
   - 登入頁：LINE 官方登入 ➜ Google 官方一鍵登入 ➜ 通行密鑰登入 (Passkey)。
   - 註冊頁：LINE 官方註冊 ➜ Google 官方一鍵註冊。
3. **經典文字分隔線 (Divider)**：快捷按鈕與下方傳統表單之間加入優雅細線與說明文字：
   - 登入頁：`────── 或使用電子信箱登入 ──────`
   - 註冊頁：`────── 或填寫資料註冊 ──────`
4. **雙重驗證專注動線 (2FA Guard)**：登入頁進入雙重驗證（TOTP 或 Email OTP 挑戰碼輸入）步驟時，自動隱藏頂部快捷按鈕群組，避免操作干擾。
5. **引導連結位置 (Footer Navigation)**：`沒有帳號？立即註冊` 與 `已經有帳號？登入` 保持於卡片最底部。

---

## 2. 規格細節

### 2.1 基礎卡片外殼 (`app/[locale]/components/AuthFormShell.tsx`)
- 新增可選屬性 `headerExtras?: ReactNode`：
  - 渲染於 `<h1>{title}</h1>` 下方、`<form>` 上方。
  - 若未傳入則維持現有佈局，完全向下相容。

### 2.2 通行密鑰按鈕 (`app/[locale]/login/PasskeyLoginButton.tsx`)
- 新增可選屬性 `hideDivider?: boolean`（預設為 `false`）：
  - 當與第三方登入組件並列置頂時，設為 `hideDivider={true}`，不渲染組件內部的獨立分隔線，由外層容器統一管理。

### 2.3 登入頁面與表單 (`app/[locale]/login/LoginForm.tsx`)
- 在常規密碼登入模式（非 2FA 挑戰階段）時，透過 `headerExtras` 渲染頂部快捷區塊：
  - 垂直排列：`<LineSignInButton mode="login" />`、`<GoogleSignInButton clientId={googleClientId} />`、`<PasskeyLoginButton hideDivider />`。
  - 下方緊接分隔線：
    ```tsx
    <div className="relative my-4 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <span className="relative bg-surface px-3 text-xs text-ink-light">
        {t("orEmailLogin")}
      </span>
    </div>
    ```
- 當 `totpRequired` 或 `challengeToken` 存在時，不渲染頂部快捷區塊。
- 表單底部保留 `沒有帳號？立即註冊`。

### 2.4 註冊頁面與表單 (`app/[locale]/register/RegisterForm.tsx`)
- 透過 `headerExtras` 渲染頂部快捷區塊：
  - 垂直排列：`<LineSignInButton mode="register" />`、`<GoogleSignInButton clientId={googleClientId} />`。
  - 下方緊接分隔線：
    ```tsx
    <div className="relative my-4 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <span className="relative bg-surface px-3 text-xs text-ink-light">
        {t("orEmailRegister")}
      </span>
    </div>
    ```
- 表單底部保留 `已經有帳號？登入`。

### 2.5 多語系支援 (`messages/*.json`)
- `login.orEmailLogin`:
  - `zh-TW`: "或使用電子信箱登入"
  - `zh-CN`: "或使用电子邮箱登录"
  - `en`: "or sign in with email"
- `register.orEmailRegister`:
  - `zh-TW`: "或填寫資料註冊"
  - `zh-CN`: "或填写资料注册"
  - `en`: "or register with details"

---

## 3. 驗證標準
1. 單元測試：登入頁、註冊頁、Passkey 與各按鈕組件測試全數通過。
2. 靜態檢驗：`npm run typecheck` 0 錯誤、`npm run lint` 0 錯誤。
3. 生產構建：`npm run build` 打包成功。
4. 視覺與功能驗證：
   - 造訪 `/login`，依序呈現 LINE、Google、Passkey 按鈕，下方為「或使用電子信箱登入」與帳密表單。
   - 造訪 `/register`，依序呈現 LINE、Google 按鈕，下方為「或填寫資料註冊」與註冊長表單。
   - 觸發 2FA 步驟時，頂部按鈕自動隱藏。
