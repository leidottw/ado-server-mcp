# Changelog

本專案的所有重要變更皆記錄於此檔案。

格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本號遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

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
