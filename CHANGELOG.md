# Changelog

本專案的所有重要變更皆記錄於此檔案。

格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本號遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

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
