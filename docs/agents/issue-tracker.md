# 議題追蹤：GitHub

本儲存庫的 Issues 與 PRD 均以 GitHub Issues 管理。所有操作請使用 `gh` CLI。

## 慣例

- **建立議題**：`gh issue create --title "..." --body "..."`。多行內文請使用 heredoc。
- **讀取議題**：`gh issue view <number> --comments`，並使用 `jq` 篩選留言，同時取得標籤。
- **列出議題**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，並套用適當的 `--label` 與 `--state` 篩選條件。
- **在議題留言**：`gh issue comment <number> --body "..."`
- **套用／移除標籤**：`gh issue edit <number> --add-label "..."`／`--remove-label "..."`
- **關閉議題**：`gh issue close <number> --comment "..."`

請從 `git remote -v` 判斷儲存庫；在 clone 目錄中執行時，`gh` 會自動處理。`origin` 是 https://github.com/j172/bid.git。

## 將 Pull request 作為分類處理入口

**PR 是否作為需求入口：否。**（若本儲存庫將外部 PR 視為功能需求，請設為 `yes`；`/triage` 會讀取此旗標。）

設為 `yes` 時，PR 會使用對應的 `gh pr` 指令，套用與 Issues 相同的標籤與狀態：

- **讀取 PR**：使用 `gh pr view <number> --comments`，並使用 `gh pr diff <number>` 查看差異。
- **列出待分類的外部 PR**：執行 `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`，然後只保留 `authorAssociation` 為 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的項目（排除 `OWNER`／`MEMBER`／`COLLABORATOR`）。
- **留言／加標籤／關閉**：使用 `gh pr comment`、`gh pr edit --add-label`／`--remove-label`、`gh pr close`。

GitHub 的 Issue 與 PR 共用編號，因此單獨的 `#42` 可能代表其中任一項；請先執行 `gh pr view 42` 確認，若不是 PR，再改用 `gh issue view 42`。

## 技能指示「發布至議題追蹤系統」時

請建立 GitHub Issue。

## 技能指示「取得相關工作票」時

請執行 `gh issue view <number> --comments`。

## Wayfinder 操作

供 `/wayfinder` 使用。**地圖**是一個 Issue，並以**子議題**作為工作票。

- **地圖**：一個標有 `wayfinder:map` 的 Issue，內文包含 Notes／Decisions-so-far／Fog。使用 `gh issue create --label wayfinder:map` 建立。
- **子工作票**：將 Issue 作為 GitHub 子議題連結至地圖（使用 `gh api` 的 sub-issues endpoint）。若未啟用子議題，請將子議題加入地圖內文的工作清單，並在子議題內文開頭加上 `Part of #<map>`。標籤使用 `wayfinder:<type>`（`research`／`prototype`／`grilling`／`task`）。工作票有人接手後，指派給負責推進的開發者。
- **阻擋關係**：使用 GitHub **原生 Issue 相依關係**——這是標準且可在 UI 中查看的表示方式。使用 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` 新增相依關係，其中 `<blocker-db-id>` 是阻擋項目的數字型 **database id**（執行 `gh api repos/<owner>/<repo>/issues/<n> --jq .id` 取得，_不是_ `#number` 或 `node_id`）。GitHub 會回報 `issue_dependencies_summary.blocked_by`（僅包含尚未關閉的阻擋項目，作為即時門檻）。若無法使用相依關係，則在子議題內文最上方加上 `Blocked by: #<n>, #<n>` 作為備援。所有阻擋項目都關閉後，工作票才解除阻擋。
- **可領取工作票查詢**：列出地圖中尚未關閉的子項目（使用 `gh issue list --state open`，並限定為該地圖的子議題／工作清單），排除仍有未關閉阻擋項目（`issue_dependencies_summary.blocked_by > 0`，或 `Blocked by` 行中列出的議題尚未關閉）或已指派負責人的項目；依地圖中的順序選取第一項。
- **接手**：使用 `gh issue edit <n> --add-assignee @me`——這是本工作階段的第一次寫入操作。
- **解決**：依序執行 `gh issue comment <n> --body "<answer>"`、`gh issue close <n>`，然後在地圖的 Decisions-so-far 中附加情境參考連結（gist + link）。
