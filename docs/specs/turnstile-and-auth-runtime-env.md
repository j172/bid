# 規格：登入／註冊／聯絡表單執行期環境變數動態渲染與 LINE／Google 登入整合

## 1. 背景與目標

### 現況痛點
1. **SSG 預渲染導致執行期環境變數被寫死為 `null`**：
   - Issue #354（Commit `6be4adc`）移除 `app/[locale]/layout.tsx` 伺服器端對 `cookies()` 的讀取後，`/[locale]/login`、`/[locale]/register`、`/[locale]/contact` 在 `next build` 時轉為靜態預渲染（SSG）。
   - 本專案採 GitHub Actions 預先建置 `.prebuilt-next.tgz` 再透過 FTPS/SSH 部署至正式機，而 `CLOUDFLARE_TURNSTILE_SITE_KEY` 與 `GOOGLE_CLIENT_ID` 僅存於正式機執行期 `.env`，不在 CI 建置環境中。
   - 結果正式站 `/login` 與 `/contact` 的 RSC payload 被寫死為 `{"turnstileSiteKey":null}`，前端不顯示 Cloudflare Turnstile 勾選框並送出空 token `""`，後端 `POST /api/auth/login` 與 `POST /api/contact` 在正式機執行期讀到 `CLOUDFLARE_TURNSTILE_SECRET_KEY` 後立即拒絕，導致所有密碼登入（含重設密碼後登入）與聯絡表單皆失敗並顯示 `Verification failed. Please complete the verification and try again.`（`TURNSTILE_VERIFICATION_FAILED`）。
2. **Google 登入與 Google One Tap 在正式站消失**：
   - 同樣因 CI 建置期無 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`，`/login` 與 `/register` 的 `GoogleSignInButton` 以及全站 `GoogleOneTap` 拿不到 Client ID 而無法渲染。
3. **LINE Login 與認證快捷按鈕置頂尚未合入 `master`**：
   - Issue #360（LINE Login v2.1 整合）與 Issue #362（登入／註冊快捷按鈕置頂）及 Turnstile 錯誤碼記錄（PR #370）尚未整合部署至 `master`。

### 預期成果
1. **恢復正式站密碼登入與聯絡表單 Turnstile 驗證**：`/[locale]/login`、`/[locale]/register`、`/[locale]/contact` 強制於伺服器執行期動態渲染（`export const dynamic = "force-dynamic"`），直接讀取正式機 `.env` 的 `CLOUDFLARE_TURNSTILE_SITE_KEY` 與 `GOOGLE_CLIENT_ID`，正常顯示 Turnstile 勾選框並通過驗證。
2. **恢復全站 Google One Tap 與 Google／LINE 快捷登入**：
   - `GET /api/auth/me` 一併回傳執行期 `googleClientId`，由 `CurrentUserProvider` 提供給 `GoogleOneTap` 作為執行期 fallback，無須破壞全站靜態頁面的 SSG 快取。
   - 整合 LINE Login v2.1（#360）、快捷按鈕置頂（#362）與 Turnstile 錯誤碼日誌（#370）一併上線。

---

## 2. 範圍

- 修改與整合範圍：
  - `app/[locale]/login/page.tsx`：加上 `export const dynamic = "force-dynamic"`，並以 `.trim() || null` 讀取 `CLOUDFLARE_TURNSTILE_SITE_KEY` 與 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`／`GOOGLE_CLIENT_ID`。
  - `app/[locale]/register/page.tsx`：加上 `export const dynamic = "force-dynamic"`，並以 `.trim() || null` 讀取 `googleClientId`。
  - `app/[locale]/contact/page.tsx`：加上 `export const dynamic = "force-dynamic"`，並以 `.trim() || null` 讀取 `CLOUDFLARE_TURNSTILE_SITE_KEY`。
  - `app/api/auth/me/route.ts`、`app/[locale]/components/CurrentUserProvider.tsx`、`app/[locale]/components/CurrentUserProvider.test.tsx`、`app/[locale]/components/GoogleOneTap.tsx`：由 `/api/auth/me` 回傳執行期 `googleClientId` 並透過 context 供給 `GoogleOneTap`。
  - 整合 `agent/issue-362-auth-buttons-relayout`（含 #360 LINE Login 與 #362 快捷按鈕置頂）及 `fix/turnstile-log-error-codes`（#370）。

---

## 3. 非目標

- 不放寬 `lib/turnstile.ts` 伺服器端 `verifyTurnstileToken` 的 fail-closed 驗證邏輯。
- 不將 `app/[locale]/layout.tsx` 改回動態渲染，確保 `/privacy`、`/terms`、`/refund`、`/gdpr` 等頁面維持 SSG。
- 不在程式碼庫或 GitHub Actions workflow 中硬編碼任何機密金鑰（Secrets）。

---

## 4. 驗收標準

- [ ] `app/[locale]/login/page.tsx`、`app/[locale]/register/page.tsx`、`app/[locale]/contact/page.tsx` 均宣告 `export const dynamic = "force-dynamic"`，且在 `npm run build` 路由表中顯示為 `ƒ (Dynamic)`。
- [ ] `/[locale]/privacy`、`/[locale]/terms`、`/[locale]/refund`、`/[locale]/gdpr` 等靜態頁面在 `npm run build` 中維持 `● (SSG)`。
- [ ] `CLOUDFLARE_TURNSTILE_SITE_KEY` 與 `GOOGLE_CLIENT_ID` 讀取時均經 `.trim() || null` 正規化，空字串不會被當成有效金鑰。
- [ ] `GET /api/auth/me` 回傳 `googleClientId`，`CurrentUserProvider` 與 `GoogleOneTap` 能於執行期取得該值，且通過單元測試驗證。
- [ ] 整合 #360（LINE Login）、#362（快捷按鈕置頂）與 #370（Turnstile error-codes log），且 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 全數通過。

---

## 5. 風險與復原

- **風險評估**：
  - `/login`、`/register`、`/contact` 改為每次請求 SSR，此為 Issue #354 之前的既有行為，不影響拍賣或靜態內容頁快取。
  - LINE Login 依賴正式機資料庫 `users` 表新增欄位（已透過 `lib/db.ts` 自動遷移 `ensureAccountColumns` 處理）與 `.env` 中的 `LINE_CHANNEL_*` 設定。
- **復原計畫**：
  - 若部署後出現異常，可透過 `git revert` 退回本次合併 commit，重新觸發 `deploy-ftps.yml` 恢復上一版產物。

---

## 6. 驗證計畫

1. 單元測試：`npx vitest run app/[locale]/components/CurrentUserProvider.test.tsx lib/turnstile.test.ts lib/lineAuth.test.ts`
2. 全域檢查：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`
3. 正式站驗證：部署完成後檢查 `https://xiangshuicn.cc/en/login` 與 `https://xiangshuicn.cc/login` 回應是否為動態渲染且包含非空的 `turnstileSiteKey`，並確認 LINE／Google 登入按鈕正常渲染。
