# Changelog

本專案的所有重要變更皆記錄於此檔案。

格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本號遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

### Changed

- Wiki 相關工具（`get_wiki_page`、`list_wiki_pages`、`create_wiki_page`、`update_wiki_page`、`delete_wiki_page`、`search_wiki`、`get_wikis`）的 description 補充說明：頁面邏輯路徑與 `search_wiki` 回傳的底層 git 檔案路徑格式不同不可混用；`version`（ETag）僅用於 projectWiki、`branch` 僅用於 codeWiki，呼叫前應先以 `get_wikis` 的 `type` 欄位判斷

## [0.10.1] - 2026-06-14

### Fixed

- README 功能清單未隨版本更新，補齊 0.9.0 至 0.10.0 期間新增的工具與參數說明

## [0.10.0] - 2026-06-14

### Added

- `contentFile` 參數：`create_wiki_page`、`update_wiki_page` 可改傳本機檔案路徑取代 inline `content`，節省 output token
- `descriptionFile` 參數：`create_pull_request`、`update_pull_request` 可改傳本機檔案路徑取代 inline `description`，節省 output token
- `delete_wiki_page`：刪除 Wiki 指定頁面

## [0.9.0] - 2026-06-13

此版本包含四項 token 優化改進：

| 改進名稱 | 目的 | 新增參數 | 適用工具 |
| ------- | ---- | ------- | ------- |
| **Build Log Grep** | 在 server 端過濾 log，只回傳命中行與上下文，避免整份大型 log 佔用 context | `grep`、`grepContext`、`maxMatches` | `get_build_logs` |
| **Work Item Rows Format** | 多筆 work item 改以欄名 + 二維陣列回傳，消除重複的 key 名稱 | `format` | `query_work_items`、`run_query` |
| **List Detail Level** | 列表工具預設只回識別與狀態欄位，需要完整欄位時再指定 `full` ⚠️ Breaking change | `detail` | `get_pull_requests`、`list_pipeline_runs`、`get_pull_request_threads`、`list_wiki_pages` |
| **File Handoff** | 大型內容超過閾值自動寫入暫存檔，回傳路徑與 preview，讓 agent 按需讀取 | `output` | `get_build_logs`、`get_pipeline_definition_yaml`、`get_wiki_page`、`get_pull_request_diff`、`get_file_content`、`query_work_items`、`run_query` |

### Changed

- `get_build_logs` 新增 `grep`、`grepContext`、`maxMatches` 參數：提供 `logId` 時可用正規表示式過濾 log 行，只回傳符合的行及其上下文，大幅節省 token；建議搭配 `get_build_timeline` 取得 errorIssues 後再 grep 關鍵字
- `query_work_items` / `run_query` 新增 `format` 參數：設為 `rows` 時 `workItemDetails` 改以 `fieldNames + rows` 二維陣列回傳，50 筆以上搭配 `fetchFields` 可省 40–60% output token
- `get_pull_requests`、`list_pipeline_runs`、`get_pull_request_threads`、`list_wiki_pages` 新增 `detail` 參數（預設 `minimal`）：`minimal` 只回傳識別與狀態欄位，省略大型子物件與頁面內容，可省 70–80% output token；需要完整欄位時傳入 `detail: "full"` ⚠️ **Breaking change**：舊行為等同 `detail: "full"`，未指定時預設改為 `minimal`

### Added

- 新增 `src/fileHandoff.ts` 共用模組：大型內容超過 `ADO_MCP_INLINE_LIMIT`（預設 10000 字元）時自動寫入暫存檔（`$TMPDIR/ado-mcp/`）並回傳路徑 + preview，讓 agent 用 Read/Grep 工具按需讀取，大幅節省 token
  - 環境變數 `ADO_MCP_OUTPUT_DIR`、`ADO_MCP_INLINE_LIMIT`、`ADO_MCP_FILE_HANDOFF`（設為 `off` 可停用）
  - 適用工具各新增 `output: "inline" | "file" | "auto"` 參數（預設 `auto`）：`get_build_logs`（有 logId 且無 grep）、`get_pipeline_definition_yaml`、`get_wiki_page`、`get_pull_request_diff`、`get_file_content`、`query_work_items` / `run_query`（有 fetchFields）

## [0.8.1] - 2026-06-13

### Fixed

- 補齊 `README.md` 功能清單：新增 0.8.0 遺漏的 Git 管理分類（6 個工具）、Pipeline 補強（`get_build_timeline`、`cancel_build`）、PR 補強（`get_pull_request_diff`、`get_pull_request_work_items`）、Work Items 補強（`delete_work_item`、`get_work_item_revisions`、`list_queries`、`run_query`、`download_work_item_attachment`、`add_work_item_attachment`）

## [0.8.0] - 2026-06-13

### Added

- Git 工具（新檔案 `src/tools/git.ts`，toolset: `git`）：
  - `get_pull_request_diff`（P0）：取得 PR 的 unified diff，自動略過二進位檔與超過 1 MB 的檔案並於 skippedFiles 標註
  - `get_file_content`（P0）：讀取任意分支 / commit / tag 的檔案內容，支援行範圍切割
  - `list_branches`（P0）：列出儲存庫分支，標示預設分支
  - `list_commits`（P0）：依分支、路徑、作者、日期範圍篩選 commit 歷程
  - `get_commit`（P0）：取得單一 commit 詳情與變更檔案清單（不含 diff）
  - `search_code`（P1）：依關鍵字搜尋程式碼（需 ADO Server 安裝 Search extension）
- Pipelines 補強：
  - `get_build_timeline`（P0）：取得 Build 執行時間軸（stage/job/task 成敗），`failedOnly: true` 預設只回傳失敗節點及祖先鏈
  - `cancel_build`（P1）：取消正在執行的 Build
- Pull Requests 補強：
  - `get_pull_request_work_items`（P1）：取得 PR 關聯的工作項目清單（含摘要）
  - `update_pull_request` 新增完成選項（P1）：`mergeStrategy`、`deleteSourceBranch`、`mergeCommitMessage`（僅 `status: completed` 時有效）
- Work Items 補強：
  - `download_work_item_attachment`（P1）：下載附件至暫存檔並回傳路徑
  - `add_work_item_attachment`（P1）：上傳本機檔案為工作項目附件
  - `list_queries`（P1）：列出專案共用查詢（樹狀結構）
  - `run_query`（P1）：執行共用查詢（by queryId），格式與 query_work_items 一致
  - `get_work_item_revisions`（P1）：取得工作項目欄位變更歷程
  - `delete_work_item`（P1）：將工作項目軟刪除至資源回收筒
- 新增 `diff` 套件相依，用於 `get_pull_request_diff` 產生 unified diff

## [0.7.1] - 2026-06-12

### Changed

- `search_wiki` 的 `project` 參數改為 `projectName`，讓命名自描述

## [0.7.0] - 2026-06-12

### Added

- 新增 `get_me` 工具，透過 PAT Token 取得目前登入使用者的顯示名稱、帳號（uniqueName）與 ID
- `update_work_item` 新增 `removeRelations` 參數，可依 url（及選填 rel）比對現有連結並移除，補齊與 `addRelations` 對稱的操作

## [0.6.0] - 2026-06-12

### Added

- 新增 `get_work_item_type_fields` 工具，取得指定工作項目類型的完整欄位定義（含 referenceName、是否必填、allowedValues、預設值）
- 對 `list_projects`、`get_project`、`get_project_teams`、`get_team`、`get_team_members`、`list_iterations`、`list_team_iterations`、`list_pipelines`、`get_pipeline_definition`、`get_pipeline_definition_yaml`、`get_repositories`、`list_work_item_types`、`get_work_item_type_fields` 等回傳不易變動資料的工具加入勿重複呼叫提示，避免在同一對話中重複消耗 context window
- 新增 Wiki 相關工具（對應 tiberriver256-azure-devops-mcp 的 wiki 功能）：
  - `get_wikis`：列出 Collection 或指定專案下所有 Wiki
  - `get_wiki_page`：取得指定頁面內容與中繼資料
  - `list_wiki_pages`：取得 Wiki 頁面樹狀結構（支援 recursionLevel）
  - `create_wiki_page`：建立新頁面或子頁面（CodeWiki 須指定 branch）
  - `update_wiki_page`：更新現有頁面內容（自動取得 ETag，無需手動傳入）
  - `search_wiki`：依關鍵字全文搜尋 Wiki 頁面（project 參數限定填名稱，不支援 ID）

## [0.5.4] - 2026-06-08

### Added

- 新增 `create_iteration` 工具，在指定父路徑下建立 Iteration 節點，支援起訖日期
- 新增 `update_iteration` 工具，更新既有 Iteration 節點的名稱或起訖日期
- 新增 `list_iterations` 工具，查詢專案下的 Iteration / Area 樹狀結構（支援 depth 參數）
- 新增 `assign_team_iteration` 工具，將 Iteration 節點指派給指定 Team
- 新增 `list_team_iterations` 工具，查詢 Team 已指派的 Iteration 清單（支援 timeframe 篩選）
- 新增 `add_work_item_tags` 工具，安全附加 Tag 至工作項目（merge 現有 Tag，不覆蓋）
- 新增 `remove_work_item_tags` 工具，從工作項目精確移除指定 Tag，保留其餘 Tag

## [0.5.3] - 2026-06-07

### Fixed

- 修正 `get_pull_request_threads` 輸出結構驗證錯誤：ADO API 回傳的 `identities` 欄位可能為 `null`，output schema 缺少 `nullable()` 導致 MCP output validation 失敗

## [0.5.2] - 2026-06-07

### Fixed

- 修正 `create_pull_request_thread`、`get_pull_request_threads`、`update_pull_request_thread` 輸出結構驗證錯誤：ADO API 回傳的 `status` 為數字 enum，output schema 錯誤定義為 `string`，導致 MCP output validation 失敗

## [0.5.0] - 2026-06-07

### Added

- 新增 `get_pull_request_threads` 工具，取得 PR 所有討論串（獨立於 `get_pull_request_details` 之外，供防呆檢查使用）
- 新增 `get_pull_request_statuses` 工具，取得 PR 的 CI/build 狀態清單
- `create_pull_request_thread` 支援 `filePath`、`lineNumber`、`status` 參數，可將討論串錨定至特定程式碼行

### Changed

- `create_pull_request_comment` 更名為 `create_pull_request_thread`（對應 ADO `createThread` API，建立的實體為 Thread）
- `reply_pull_request_thread` 更名為 `create_pull_request_thread_comment`（對應 ADO `createComment` API，建立的實體為 Thread 內的 Comment）
- `get_pull_request_file_changes` 更名為 `get_pull_request_changes`（語意複合命名，隱藏 iteration 細節）

## [0.4.0] - 2026-06-06

### Added

- 新增 Pipelines 模組，包含 `list_pipelines`、`list_pipeline_runs`、`get_pipeline_run`、`queue_pipeline` 工具
- 新增 `get_pipeline_definition` 工具，取得 Pipeline 定義的詳細資訊（repository、變數等）
- 新增 `get_pipeline_definition_yaml` 工具，取得 Pipeline 的完整 YAML 內容
- 新增 `get_build_logs` 工具，取得 Build log 清單或特定 log 內容
- 新增 PR 評審操作工具：`update_pull_request_reviewer`、`reply_pull_request_thread`、`update_pull_request_thread`、`get_pull_request_file_changes`
- 新增 `get_work_item_comments` 工具，取得工作項目的評論清單

### Changed

- 移除 `dotenv-cli` 依賴，改用 Bun 原生 `.env` 支援

## [0.3.1] - 2026-06-06

### Changed

- `get_work_item` 新增 `includeLinks` 與 `includeRelations` 參數（預設 `false`），明確控制是否回傳 `_links` 與 `relations`，減少欄位過濾時的回傳雜訊

## [0.3.0] - 2026-06-06

### Added

- `get_work_item` 支援 `fields` 參數，可指定要回傳的欄位清單
- `query_work_items` 支援 `fetchFields` 參數，可在 WIQL 查詢後一次取得指定欄位的工作項目詳細資料

### Removed

- 移除 `get_work_items_batch` tool，功能由 `query_work_items` 搭配 `fetchFields` 取代

## [0.2.1] - 2026-06-05

### Added

- 新增 `build.ts` 建置腳本，取代原本的 tsc 直接呼叫

### Changed

- 強化 production build 設定
- 更新快速開始與設定說明

## [0.2.0] - 2026-06-05

### Added

- 新增 work items 完整管理工具：`get_work_item`、`query_work_items`、`create_work_item`、`update_work_item`
- 新增 pull request 管理工具：`create_pull_request`、`get_pull_request`、`list_pull_requests`，支援 `isDraft` 參數
- 新增專案管理工具：`list_projects`、`get_project`
- 遷移至 `azure-devops-node-api` 官方函式庫

### Changed

- 預設 API 版本升級至 7.0
