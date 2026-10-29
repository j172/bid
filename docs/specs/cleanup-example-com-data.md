# Spec: 正式站 `example.com` 測試資料與關聯紀錄清理

## 1. 背景與問題描述 (Problem Statement)

管理員登入正式站（`https://xiangshuicn.cc`）後台時，發現資料庫中留有早期測試或驗證時建立的 `@example.com` 測試帳號與相關紀錄。程式碼庫本身並無寫死 `@example.com` 的種子資料（僅測試檔 `*.test.*` 使用），這些資料僅存在於正式站遠端 MySQL 資料庫中。

需要透過可稽核、具備交易保護（Transaction）與執行前備份機制的一次性清理腳本與 SSH workflow，將正式站資料庫中所有 `@example.com` 帳號及其關聯紀錄完整清除，並在執行完成後移除一次性 workflow（比照 `#368`／`#369` 模式）。

## 2. 清理範圍與資料表關聯 (Scope & Cascade Order)

針對 `LOWER(email) LIKE '%@example.com'` 的測試使用者（`exampleUserIds`）與直接含有 `example.com` 的紀錄，在單一 MySQL Transaction 內依下列順序清理：

1. **測試帳號所建立的拍賣商品（`listings.created_by IN (exampleUserIds)`）及其子表**：
   - `bids`（`listing_id IN (exampleListingIds)`）
   - `purchases`（`listing_id IN (exampleListingIds)`）
   - `listing_photos`（`listing_id IN (exampleListingIds)`）
   - `listings`（`id IN (exampleListingIds)`）
2. **測試帳號在其他商品上的出價與訂單紀錄**：
   - 記錄受影響的其他商品 ID（曾被 `exampleUserIds` 出價或 `leader_user_id IN (exampleUserIds)` 的 `listings`）
   - `bids`（`user_id IN (exampleUserIds)`）
   - `purchases`（`buyer_id IN (exampleUserIds)`）
   - `product_orders`（`buyer_id IN (exampleUserIds)`）
   - 重新計算受影響存續商品的 `leader_user_id`、`leader_max_amount` 與 `current_price`（若無剩餘出價則重置為 `leader_user_id = NULL`、`leader_max_amount = NULL`、`current_price = COALESCE(starting_price, price, 0)`）
3. **測試帳號的認證與挑戰紀錄（`user_id IN (exampleUserIds)`）**：
   - `sessions`
   - `password_reset_tokens`
   - `email_verification_tokens`
   - `email_otp_challenges`
   - `webauthn_challenges`
   - `webauthn_credentials`
   - `totp_setup_challenges`
   - `totp_backup_codes`
4. **測試帳號本身**：
   - `users`（`id IN (exampleUserIds)`）
5. **非 `user_id` 關聯但直接含 `example.com` 的資料列**：
   - `contact_messages`（`LOWER(email) LIKE '%@example.com'`）
   - `login_attempts`（`LOWER(email) LIKE '%@example.com'`）

## 3. 實作設計 (Implementation Details)

1. **`scripts/cleanup-example-data.mjs` 與單元測試 `scripts/cleanup-example-data.test.mjs`**：
   - 比照 `scripts/cleanup-closed-listings.mjs` 與 `scripts/cleanup-herbots-news.mjs` 架構，提供 `planCleanup(conn)`（唯讀試算各表受影響筆數與清單）與 `executeCleanup(conn)`（單一 Transaction 內依序刪除並回傳實際刪除筆數，失敗時自動 `ROLLBACK`）。
   - 預設為 `--dry-run`，僅在傳入 `--confirm` 時才執行刪除。
2. **一次性遠端執行腳本與 GitHub Actions Workflow**：
   - `scripts/remote-cleanup-example-data.sh`：於遠端主機 `~/bid_app` 先使用 `mysqldump --single-transaction` 建立資料庫備份（存放於 `~/bid_app/.backups/` 並設定 `chmod 600` 與檢查檔案非空），接著先執行 `--dry-run` 輸出完整試算明細，再執行 `--confirm` 完成刪除，最後再次執行 `--dry-run` 驗證剩餘筆數皆為 `0`。
   - `.github/workflows/cleanup-example-data.yml`：`workflow_dispatch` 觸發，透過 `appleboy/ssh-action@v1` 將 `scripts/cleanup-example-data.mjs` 同步或直接於遠端執行清理腳本。
   - 正式站清理完成並驗證為 0 筆後，發 PR 移除 `.github/workflows/cleanup-example-data.yml` 與 `scripts/remote-cleanup-example-data.sh`（保留 `scripts/cleanup-example-data.mjs` 與其測試供日後稽核）。

## 4. 驗收條件 (Acceptance Criteria)

- [ ] AC1: `scripts/cleanup-example-data.mjs` 支援 `--dry-run`（預設）與 `--confirm`，並在單一交易內清理所有 `@example.com` 使用者與上述關聯表資料，且具備完整的 `scripts/cleanup-example-data.test.mjs` 測試覆蓋。
- [ ] AC2: 透過一次性 GitHub Actions SSH workflow 在正式站完成資料庫備份與 `@example.com` 資料刪除，確認刪除後 `--dry-run` 試算所有表皆為 `0` 筆。
- [ ] AC3: 正式站清理完成後，移除一次性 workflow 與遠端 shell 腳本，保持倉庫整潔，且 `npm run lint`、`npm run typecheck`、`npm test` 全部通過。

