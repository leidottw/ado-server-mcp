# Changelog

本專案的所有重要變更皆記錄於此檔案。

格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本號遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [0.2.0] - 2026-06-05

### Added

- 新增 work items 完整管理工具：`get_work_item`、`query_work_items`、`create_work_item`、`update_work_item`
- 新增 pull request 管理工具：`create_pull_request`、`get_pull_request`、`list_pull_requests`，支援 `isDraft` 參數
- 新增專案管理工具：`list_projects`、`get_project`
- 遷移至 `azure-devops-node-api` 官方函式庫

### Changed

- 預設 API 版本升級至 7.0
