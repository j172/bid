# 已結標商品一次性清理 Runbook（GitHub issue #279）

適用範圍：`scripts/cleanup-closed-listings.mjs` —— 永久刪除正式環境資料庫中所有
`listings.status='closed'` 的商品，以及透過 `listing_id` 關聯的 `bids`／
`purchases`／`listing_photos` 紀錄。**不限時間範圍，全部刪除，且不可逆。**

這是**一次性資料清理動作**，不是常駐後台功能，也**不應**由 CI 或 agent
無人值守執行。正式環境的實際刪除（`--confirm`）必須由人工在確認備份與
dry-run 結果後親自執行。

## 執行前必要步驟

1. **完整資料庫備份，並驗證可還原**
   ```bash
   mysqldump --single-transaction -u <user> -p <database> > backup-before-279-$(date +%Y%m%d-%H%M%S).sql
   ```
   備份後務必實際還原到一個測試資料庫確認可用，不要只做備份不驗證。

2. **輔助交叉核對**：到後台「已結標結算」頁面（`/z04urru6/listings/closed`）
   點「匯出 CSV」（`/api/admin/listings/closed/export`），保留一份刪除前的
   已結標商品清單，供事後核對筆數與追溯。

3. **在備份或測試資料庫上先驗證腳本**，而不是直接對正式環境下 `--confirm`。

## 執行步驟

1. Dry run（預設行為，不會刪除任何資料）：
   ```bash
   node scripts/cleanup-closed-listings.mjs
   # 或明確指定
   node scripts/cleanup-closed-listings.mjs --dry-run
   ```
   檢視輸出的每張表筆數（`bids`／`purchases`／`listing_photos`／`listings`），
   確認數字與後台「已結標結算」清單的規模相符、沒有異常暴增或為零。

2. 確認備份已完成、dry-run 筆數合理後，**由人工**執行實際刪除：
   ```bash
   node scripts/cleanup-closed-listings.mjs --confirm
   ```
   腳本會先印出不可逆警告，接著在單一資料庫交易（transaction）內依序刪除
   `bids` → `purchases` → `listing_photos` → `listings`；任何一步失敗都會
   `ROLLBACK`，不會留下刪一半的資料。

3. 執行完成後，將終端機印出的摘要（各表刪除筆數）貼到此次執行紀錄／issue
   留存，作為稽核軌跡。

## 執行後驗證

- 後台「已結標結算」列表（`/z04urru6/listings/closed`）：確認清單已清空，
  頁面無錯誤。
- 後台「訂單管理」／相關頁面：確認沒有因孤兒資料（orphan rows）導致的
  顯示異常或 500 錯誤。
- 資料庫層面：`SELECT COUNT(*) FROM listings WHERE status='closed'` 應為 0，
  `bids`／`purchases`／`listing_photos` 中不應再有指向已刪除 listing 的
  `listing_id`。

## 已核對的關聯資料表範圍

透過完整檢視 `db/init.sql`（本 repo 唯一的 schema 來源）並對全庫
`grep listing_id` / `listingId`，確認只有下列三張表透過 `listing_id` 參照
`listings`：`bids`、`purchases`、`listing_photos`。若未來新增其他帶有
`listing_id`（或等效外鍵）的資料表，**必須先更新
`scripts/cleanup-closed-listings.mjs` 的 `CASCADE_TABLES` 清單與本文件**，
才能再次信任這支腳本的完整性。

## 安全邊界

- 不建立任何後台按鈕、排程、或可重複觸發的清理功能。
- 不在 CI／agent 自動化流程中呼叫 `--confirm`。
- 只有 `--confirm` 會實際刪除資料；沒有旗標或 `--dry-run` 一律是唯讀試算。
