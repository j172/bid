# bid

以 Next.js App Router 建置的賽鴿交易平台，包含拍賣、定價商品、鴿舍與名鴿展示，以及相關社群內容。

## 開始開發

### 環境需求

- Node.js 24 或更新版本
- npm
- 可供本機開發使用的 MySQL 與環境變數

### 安裝與啟動

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

請依 [`.env.example`](./.env.example) 設定本機所需值；不要提交 `.env` 或將憑證寫入程式碼。其他 shell 環境可使用相應的檔案複製命令。

## 常用檢查

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Next.js 16.4.3 內嵌的 Webpack 尚未包含 [webpack/webpack#21647](https://github.com/webpack/webpack/pull/21647) 修正；安裝後會由 `postinstall` 套用絕對 junction 路徑處理補丁。升級 Next.js 時，請重新確認上游是否已包含修正，再更新或移除 `scripts/patch-next-webpack-symlinks.mjs`。

## 專案結構

- `app/`：Next.js 頁面、路由與 API。
- `lib/`：依功能領域組織的商業邏輯，以及共用的資料庫、用戶端、格式、媒體和網路模組。
- `db/init.sql`：資料庫結構初始化來源。
- `i18n/`、`messages/`：國際化路由設定與翻譯訊息。
- `docs/`：工程流程、維運手冊與歷史需求規格。

## 文件導覽

### 工程流程與維運

- [共享工程規範](./AGENTS.md)
- [領域文件使用方式](./docs/agents/domain.md)
- [GitHub 議題追蹤流程](./docs/agents/issue-tracker.md)
- [分類標籤](./docs/agents/triage-labels.md)
- [規格轉工作票](./docs/agents/spec-to-ticket.md)
- [Worktree 與 Subagent 流程](./docs/agents/worktree-subagent-flow.md)
- [發布與部署](./docs/agents/release-and-deploy.md)
- [502 來源主機復原操作手冊](./docs/agents/502-origin-recovery-runbook.md)
- [已結標商品一次性清理操作手冊](./docs/agents/closed-listings-cleanup-runbook.md)：正式資料刪除不可逆，執行前必須完成備份與 dry-run。
- [Hotfix 範圍紀錄（2026-08-02）](./docs/agents/hotfix-scope-2026-08-02.md)

### 歷史需求規格

- [功能與需求規格](./docs/specs/)
