# SPEC: 代理層主動自癒重試與 503 降級保護 (Proxy Auto-Heal & 502 Resilience)

## 1. 背景與目標 (Outcome)

本站部署於 cPanel/LiteSpeed 虛擬主機，由 `.remote-index.php` 擔任反向代理（Reverse Proxy）轉發給本機 Node.js（PM2 `bid-web`，監聽 `127.0.0.1:3001`）。

### 現況痛點
1. **主機資源回收盲區**：該主機環境不定時回收背景進程，當 Node.js 進程被殺掉時，PHP 端向 `127.0.0.1:3001` 發送 cURL 請求會立即遭遇 `CURLE_COULDNT_CONNECT`（errno 7）。
2. **生硬且被動的錯誤處理**：現有 `.remote-index.php` 遇到連線失敗時，立即回傳 `HTTP 502 Bad Gateway` 與純文字 `Proxy error: Failed to connect to 127.0.0.1:3001`，完全無任何主動重試或喚醒機制。
3. **外部 Watchdog 存在時間差**：目前自癒僅能等待外部定時 cron 打 `/__ops/pm2-ensure-running`（通常為 1~5 分鐘間隔），在 cron 尚未探測到的空窗期，所有訪客與搜尋引擎爬蟲均會看到 502 錯誤。

### 預期成果 (Outcome)
1. **代理層即時自癒**：當代理層偵測到 `127.0.0.1:3001` 連線中斷時，立即在背景非同步觸發 PM2 極速啟動（~1秒），並設有並發互斥鎖避免大量並發進程暴增。
2. **原地短暫重試 (In-flight Retry)**：當次請求等待 1.2 秒後自動原地重試，若 Node 已喚醒，訪客當次請求直接成功（HTTP 200），完全無感。
3. **優雅降級與 SEO 保護**：若重試後後端仍未就緒，回傳 `HTTP 503 Service Unavailable` 與 `Retry-After: 3`（保護 Googlebot 不降權）。
   - **瀏覽器請求**：回傳高質感、無外部相依之香水賽鴿品牌專屬過渡頁面（內建 3 秒自動倒數重新整理 `<meta refresh>` 與 JS `location.reload()`）。
   - **API / JSON 請求**：回傳語意化 JSON 錯誤結構。

---

## 2. 範圍 (Scope)

- 修改檔案：
  - `.remote-index.php`：反向代理核心邏輯。
  - `docs/agents/502-origin-recovery-runbook.md`：更新維運手冊與自癒機制說明。
- 影響範圍：全站所有透過反向代理轉發之路由與 API

---

## 3. 非目標 (Non-goals)

- 不更動 Node.js/Next.js 應用程式內部的業務邏輯或資料庫連線池設定。
- 不更動 Cloudflare Edge 設定或 LiteSpeed 本身之伺服器設定檔。
- 不移除現有的 `/__ops/pm2-ensure-running` 或 `/__ops/apply` 端點（保持向前相容與外部監控機制）。

---

## 4. 驗收標準 (Acceptance Criteria)

- [ ] **連線失敗自癒觸發**：當 `127.0.0.1:3001` 斷線時，`.remote-index.php` 能正確識別 `CURLE_COULDNT_CONNECT` 並以背景非阻塞模式觸發 `pm2 start ecosystem.config.cjs --only bid-web`。
- [ ] **並發鎖保護**：使用 `.fast_restart.lock`（30 秒過期保護機制），多個並發請求抵達時只有第一個能發起重啟指令，其餘請求等待重試而不重複 fork 進程。
- [ ] **原地短暫重試**：對請求進行一次原地重試（等候 ~1.2 秒）。若後端在等候後就緒，當次請求順利返回後端響應。
- [ ] **優雅降級響應**：
  - 若重試後仍失敗，狀態碼為 `HTTP 503`，標頭包含 `Retry-After: 3` 與標準安全標頭。
  - 瀏覽器訪問返回品牌風格之自動倒數 3 秒重整 HTML 頁面。
  - `Accept: application/json` 或 `/api/*` 返回 JSON：`{"ok":false,"error":"service_starting","message":"...","retry_after":3}`。
- [ ] **PHP 語法合規**：`php -l .remote-index.php` 通過無任何 syntax error。
- [ ] **全站測試通過**：現有 `npm run lint`、`npm run typecheck`、`npm test` 0 錯誤。

---

## 5. 風險與復原 (Risks & Rollback)

- **風險評估**：
  - **低風險**：改動局限於 `.remote-index.php` 的反向代理連線失敗處理分支（原本直接 exit 502 的區塊），在正常 Node.js 連線成功時完全不影響任何現有轉發效能。
- **復原計畫 (Rollback Plan)**：
  - 若正式站行為不符預期，可透過 `git revert` 還原 commit，觸發 GitHub Actions 重新發布先前版本的 `.remote-index.php`。

---

## 6. 驗證計畫 (Verification Plan)

1. 本地 PHP CLI 語法檢驗：`php -l .remote-index.php`
2. 本地 Node/Next.js 測試：`npm run lint`、`npm run typecheck`、`npm test`
3. 部署後線上驗證：
   - 探測首頁與健康端點 `https://xiangshuicn.cc/api/health` 正常回應。
   - 遠端 verification script 通過。
