# Changelog

本專案的所有重要變更皆記錄於此檔案。

格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本號遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

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
