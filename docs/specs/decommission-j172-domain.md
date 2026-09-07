# SPEC: 全面移除 j172.tw 網域並整合為單一站點 (Decommission j172.tw Domain & Consolidate to Single Site)

## 1. 背景與問題 (Background & Context)

原本專案曾並行維護舊站 `bid.j172.tw`（主機 sng101）與新站 `xiangshuicn.cc`（主機 sng105），並在 Issue #182 與 #202 中建立了雙站分流與過渡期的相容邏輯。

隨著舊站正式停止營運並進入徹底退役階段，儲存庫中殘留的 `j172.tw` 網域邏輯帶來維護負擔與潛在問題：
1. **聯絡表單後台通知信 fallback 遺留舊網域**：若主機環境未設定 `CONTACT_ADMIN_EMAIL`，程式碼 fallback 至 `j172@j172.tw`，可能導致新站顧客諮詢信件無法由營運人員接收。
2. **CI/CD 部署流程存在舊分流**：`.github/workflows/deploy-ftps.yml` 仍保留 `inputs.target` 選擇器與 `legacy`（`bid.j172.tw`）預設值，且內含寫死的舊 IP（`103.21.221.12`）與舊帳號（`j172@j172.tw`），增加誤部署風險。
3. **主機驗證腳本與維運手冊失真**：`scripts/remote-verify.sh` 與 `docs/agents/502-origin-recovery-runbook.md` 預設檢測舊網域與舊主機 IP。

## 2. 解決方案與規格 (Solution & Specifications)

### 2.1 郵件通知與環境變數
- **`lib/notifications.ts`**：
  - 更新 `resolveContactAdminEmail`：當 `CONTACT_ADMIN_EMAIL` 未設置或為空白時，預設 fallback 改為 `"service@xiangshuicn.cc"`（與 `messages/*.json` 中的官方客服信箱一致）。
- **`lib/notifications.test.ts`**：
  - 更新單元測試斷言，驗證未帶 env 時正確回傳 `"service@xiangshuicn.cc"`。
- **`.env.example`**：
  - 更新 `CONTACT_ADMIN_EMAIL` 註解說明：未填寫時預設發送至 `service@xiangshuicn.cc`，無需為此更動程式碼。

### 2.2 CI/CD 自動化部署流程
- **`.github/workflows/deploy-ftps.yml`**：
  - 移除 `inputs.target` 選擇器，回歸單一站點部署模式。
  - `DOCROOT_DIR` 固定為 `public_html`（sng105 主機根目錄）。
  - `PUBLIC_DOMAIN` 固定為 `xiangshuicn.cc`。
  - FTPS 上傳與 SSH 執行參數改為相容優先讀取 `NEW_*` Secrets，若未設置則退回無前綴標準 Secrets 名稱（`FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `OPS_KEY`, `DEPLOY_SSH_*`）。
  - 完全移除寫死之舊 IP `103.21.221.12` 與帳號 `j172@j172.tw` fallback。

### 2.3 伺服器驗證腳本與維運文檔
- **`scripts/remote-verify.sh`**：
  - `PUBLIC_DOMAIN` 預設值由 `bid.j172.tw` 改為 `xiangshuicn.cc`。
- **`docs/agents/502-origin-recovery-runbook.md`**：
  - 檢測目標全面改為 `https://xiangshuicn.cc/` 與 `https://xiangshuicn.cc/api/health`。
  - 移除舊主機直連 IP `103.21.221.12`，改為使用本機回環或標準 Origin IP 說明。
- **`lib/turnstile.ts`**：
  - 清理註解中歷史遺留之 `"j172tw"` 標記。

### 2.4 範圍保留邊界
- GitHub 遠端庫路徑 `https://github.com/j172/bid.git` 及 `AGENTS.md`、`docs/agents/issue-tracker.md` 中的 `j172` 帳號名稱維持不變。

## 3. 驗證計劃與標準 (Verification Plan & Standards)

1. **靜態分析與型別檢查**：
   - 全專案無 TypeScript 編譯錯誤（`npm run typecheck`）。
2. **單元測試**：
   - 執行 `npx vitest run`，全專案 83 個測試套件、831 項測試全數綠燈通過。
3. **專案生產打包**：
   - 執行 `npm run build`，Turbopack 99 個靜態與動態路由建置順利產出。
4. **全域掃描**：
   - 除 GitHub 遠端倉庫路徑外，程式碼與文檔中無殘留 `j172.tw` 或 `@j172.tw`。
5. **發布流程**：
   - 建立 GitHub Issue 關聯。
   - 推送分支並建立 Pull Request 合併至 `master`。
   - 觸發 `deploy-ftps.yml` 部署至正式站 `xiangshuicn.cc`。
