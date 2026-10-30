# 發布與部署

## 合併門檻

合併前，PR 必須包含 Issue 編號、驗收條件對照、測試結果、遷移說明及回滾說明。若變更可能影響執行期行為，儲存庫必須通過 lint、typecheck、測試及正式環境建置檢查。

目標分支為 `master`。合併至 `master` 會觸發 `.github/workflows/deploy-ftps.yml`；發生復原需求時，也可手動執行此 workflow。

## 正式環境部署

此 workflow 會在 GitHub Actions 中建置新的產物，透過 FTPS 上傳、透過 SSH 套用，並執行遠端驗證腳本。憑證應保留於 GitHub Actions Secrets 中，絕不可複製到儲存庫、`.env`、記錄檔或 Issue 留言。

部署作業透過 GitHub Actions concurrency 依序執行。若建置、上傳、套用或驗證任一步驟失敗，workflow 即視為失敗，不得回報為成功。

## 復原

1. 在重試前先處理失敗的執行作業，避免繼續進行其他部署。
2. 檢查失敗步驟及遠端套用／驗證輸出；不要將機密貼入工作票。
3. 重新執行最後一個已知正常的 workflow，或透過一般 PR 還原造成問題的合併。
4. 透過遠端驗證路徑確認正式站點。
5. 在相關 Issue 或 PR 中記錄事故與修正措施。

只有 workflow 成功且遠端健康檢查通過，才算完成正式環境部署。