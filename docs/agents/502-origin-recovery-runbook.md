# 502 Origin Recovery Runbook（xiangshuicn.cc）

適用症狀：Cloudflare 顯示 `Error 502` / `origin_bad_gateway`，且站點間歇性 `502/503`。

## 30 秒判斷

1. 公網檢查（首頁與健康端點）
   - `https://xiangshuicn.cc/`
   - `https://xiangshuicn.cc/api/health`
2. 若持續 5xx，直接檢查 origin（SSH 本機 loopback 或向 Origin IP 帶 Host header）
   - SSH 本機：`curl -s http://127.0.0.1:3001/api/health`
   - 直連 origin：`https://<ORIGIN_IP>/api/health` + `Host: xiangshuicn.cc`
3. 若看到下列字樣，根因即為 Node/Next 程序不在線：
   - `Proxy error: Failed to connect to 127.0.0.1:3001`

## 快速復原（優先順序）

1. **優先**：呼叫 watchdog 端點（需 `OPS_KEY`）
   - `GET /__ops/pm2-ensure-running?key=...`
   - 功能：若 `bid-web` 不在線，會觸發既有 apply/restart 流程。

2. 若仍未恢復：觸發完整 apply（需 `OPS_KEY`）
   - `GET /__ops/apply?key=...`
   - 輪詢：`GET /__ops/status?key=...` 直到 `[DONE]`
   - 出現 `[FAIL]` / `[ROLLBACK]` 代表部署包或啟動失敗，需查看 `.apply.log`。

3. 若無法走 ops endpoint：登入主機手動確認 PM2
   - 確認 `bid-web` 狀態（應為 `online`）
   - 若不在線，按 `ecosystem.config.cjs` 啟動（Node 24 + port 3001）

## 驗證完成條件

- `https://xiangshuicn.cc/api/health` 回 `200` 且含 `"ok":true`
- `https://xiangshuicn.cc/` 回 `200`
- 不再出現 Cloudflare 502/503 錯誤頁

## 已知背景（本 repo）

- 反向代理入口：`.remote-index.php`
- App 目標：`127.0.0.1:3001`
- PM2 app 名稱：`bid-web`
- 代理層即時自癒防線（Issue #364）：
  - 當 `.remote-index.php` 向 `127.0.0.1:3001` 連線失敗（errno 7/52/56）時，會立即於背景非阻塞式執行 `pm2 start ecosystem.config.cjs --only bid-web`（帶 `.fast_restart.lock` 防並發突增），並原地等候 1.2 秒進行 in-flight 重試。
  - 若重試成功，訪客當次請求直接回應 200。
  - 若重試後 Node.js 仍在啟動中，返回 `HTTP 503 Service Unavailable`（附帶 `Retry-After: 3`），網頁端顯示品牌美化自動倒數 3 秒重新整理頁面，API 則返回結構化 JSON 錯誤，避免出現生硬的 502 Proxy error。
  - 若快速重啟未果，系統自動升級觸發完整 `buildApplyCommand()`。
- 已內建 ops 端點：
  - `/__ops/pm2-status`
  - `/__ops/pm2-ensure-running`
  - `/__ops/apply`
  - `/__ops/status`

## 預防建議

1. 設定外部 cron 每 1~2 分鐘呼叫 `/__ops/pm2-ensure-running?key=...` 作為二級保障
2. 監控規則加入「連續 3 次 health 非 200 即告警」
3. 告警訊息附上「先跑 pm2-ensure-running，再看 status」操作提示

