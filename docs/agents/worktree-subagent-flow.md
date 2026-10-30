# Worktree 與 Subagent 流程

每張實作工作票都必須與主要 checkout 隔離。

## Worktree 命名

使用依 Issue 衍生的分支與 worktree：

`agent/issue-<number>-<short-kebab-title>`

請將 worktree 放在儲存庫旁邊，例如 `../bid-issue-123`。同一個 worktree 絕不可同時交由另一個 agent 使用。

## 生命週期

1. 使用 `gh issue edit <number> --add-assignee @me` 接手工作票。
2. 從目前的 `master` 建立分支與 worktree。
3. 提供 subagent Issue、驗收條件、非目標、worktree 路徑及必要檢查項目。
4. subagent 在編輯前閱讀適用的 `AGENTS.md` 檔案與現有測試。
5. subagent 僅實作工作票範圍，執行最小必要檢查，並回報變更檔案、檢查結果、風險及後續事項。
6. parent agent 依工作票審查 diff，並建立引用該 Issue 的 PR。
7. 合併前由另一位 reviewer 檢查範圍、安全性、測試及部署影響。
8. 必要的 CI 檢查通過且 PR 獲得核准後，才可合併。
9. 只有在沒有未提交工作時，才可於合併後移除 worktree。

## 交接格式

```text
Issue: #<number>
Worktree: <absolute path>
Branch: agent/issue-<number>-<slug>
Acceptance criteria:
- ...
Non-goals:
- ...
Required checks:
- ...
Do not change:
- secrets, .env, unrelated files
```

Subagent 必須回報：

- 實作摘要；
- 變更檔案及變更原因；
- 執行的檢查與結果；
- 已知風險或受阻事項；
- 建議的 PR 標題與內文。

若工作票會變更 `.github/` 自動化或 agent 檔案，交接內容也必須記錄 workflow YAML 與 custom-agent frontmatter 驗證結果。

## 安全界線

Subagent 不得直接推送至 `master`、合併自己的 PR、部署至正式環境、讀取 `.env` 或修改 GitHub secrets。合併後由受保護的 workflow 執行部署。