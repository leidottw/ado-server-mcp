# Azure DevOps Server MCP

本專案是為 Azure DevOps Server (On-Premise) 建置的自訂 MCP (Model Context Protocol) Server，使用 Bun 作為執行環境與打包工具。

## 功能

### 工作項管理

- `get_work_item` - 取得單一工作項目詳細資料
- `create_work_item` - 建立新的工作項目
- `update_work_item` - 更新工作項目欄位或工作流程狀態
- `delete_work_item` - 將工作項目軟刪除至資源回收筒
- `query_work_items` - 使用 WIQL 查詢工作項目；`format: "rows"` 以欄名 + 二維陣列回傳節省 token；`output` 控制大型結果是否寫入暫存檔
- `list_work_item_types` - 列出專案中可用的工作項目類型
- `add_work_item_comment` - 在工作項目上新增評論
- `get_work_item_comments` - 取得工作項目的評論清單
- `get_work_item_revisions` - 取得工作項目欄位變更歷程
- `get_work_item_type_fields` - 取得指定工作項目類型的完整欄位定義（含 referenceName、是否必填、allowedValues、預設值）
- `add_work_item_tags` - 安全附加 Tag 至工作項目（merge 現有 Tag，不覆蓋）
- `remove_work_item_tags` - 從工作項目精確移除指定 Tag，保留其餘 Tag
- `list_queries` - 列出專案共用查詢（樹狀結構）
- `run_query` - 執行共用查詢（by queryId），格式與 query_work_items 一致；同樣支援 `format: "rows"` 與 `output`
- `download_work_item_attachment` - 下載附件至暫存檔並回傳路徑
- `add_work_item_attachment` - 上傳本機檔案為工作項目附件

### Iteration 管理

- `create_iteration` - 在指定父路徑下建立 Iteration 節點，支援設定起訖日期
- `update_iteration` - 更新既有 Iteration 節點的名稱或起訖日期
- `list_iterations` - 查詢專案下的 Iteration / Area 樹狀結構
- `assign_team_iteration` - 將 Iteration 節點指派給指定 Team
- `list_team_iterations` - 查詢 Team 已指派的 Iteration 清單（支援 timeframe 篩選）

### 拉取請求管理

- `get_pull_requests` - 取得指定專案下的 Git 拉取請求；`detail: "minimal"`（預設）只回識別與狀態欄位，`full` 回完整物件
- `get_pull_request_details` - 取得單一拉取請求詳細資訊（含所有討論串）
- `create_pull_request` - 建立新的拉取請求；`descriptionFile` 傳本機路徑可節省 output token
- `create_pull_request_thread` - 在拉取請求上建立新討論串（支援錨定至特定程式碼行）
- `create_pull_request_thread_comment` - 在拉取請求的現有討論串中新增留言
- `get_pull_request_threads` - 取得拉取請求的所有討論串；`detail: "minimal"`（預設）截斷長 comment 並精簡 identity，`full` 回完整原文
- `get_pull_request_changes` - 取得拉取請求的檔案變更清單
- `get_pull_request_statuses` - 取得拉取請求的 CI/build 狀態清單
- `get_pull_request_diff` - 取得拉取請求的 unified diff（自動略過二進位檔與超過 1 MB 的檔案）；`output` 控制大型 diff 是否寫入暫存檔
- `get_pull_request_work_items` - 取得拉取請求關聯的工作項目清單
- `update_pull_request` - 更新拉取請求（標題、說明、狀態、草稿模式、合併策略）；`descriptionFile` 傳本機路徑可節省 output token
- `update_pull_request_reviewer` - 設定或更新拉取請求的審查者投票（核准、拒絕等）
- `update_pull_request_thread` - 更新拉取請求討論串的狀態（例如標記為已解決）

### Pipeline 管理

- `list_pipelines` - 列出專案中的 CI/CD Pipeline 定義（Build Definitions）
- `list_pipeline_runs` - 列出 Pipeline 的執行歷程（Builds）；`detail: "minimal"`（預設）只回識別與狀態欄位，`full` 回完整物件
- `get_pipeline_run` - 取得單一 Pipeline 執行（Build）的詳細資訊與結果
- `queue_pipeline` - 觸發 Pipeline 執行（Queue a Build）
- `get_pipeline_definition` - 取得單一 Pipeline 定義的詳細資訊，包含 repository、變數與觸發設定
- `get_pipeline_definition_yaml` - 取得 Pipeline 定義的完整 YAML 內容；`output` 控制大型 YAML 是否寫入暫存檔（預設 `auto`，超過 10,000 字元自動寫檔）
- `get_build_logs` - 取得 Build 的 log 清單或特定 log 的內容；`grep` 支援 server 端正規表示式過濾，只回傳命中行與上下文；`output` 控制完整 log 是否寫入暫存檔
- `get_build_timeline` - 取得 Build 執行時間軸（stage/job/task 成敗，failedOnly 模式預設只回傳失敗節點）
- `cancel_build` - 取消正在執行的 Build

### 專案管理

- `get_me` - 取得目前 PAT Token 所對應的使用者資訊（顯示名稱、帳號、ID）
- `list_projects` - 列出 Collection 中可存取的專案清單
- `get_project` - 取得單一專案的詳細資訊
- `get_project_teams` - 取得指定專案底下的團隊列表
- `get_team` - 取得特定團隊的詳細資訊
- `get_team_members` - 取得特定團隊的成員列表

### Git 管理

- `get_repositories` - 列出指定專案內的 Git 儲存庫
- `list_branches` - 列出儲存庫分支，標示預設分支
- `list_commits` - 依分支、路徑、作者、日期範圍篩選 commit 歷程
- `get_commit` - 取得單一 commit 詳情與變更檔案清單（不含 diff）
- `get_file_content` - 讀取任意分支 / commit / tag 的檔案內容，支援行範圍切割；`output` 控制大型檔案是否寫入暫存檔
- `search_code` - 依關鍵字搜尋程式碼（需 ADO Server 安裝 Search extension）

### Wiki 管理

- `get_wikis` - 列出 Collection 或指定專案下所有 Wiki
- `get_wiki_page` - 取得 Wiki 指定頁面的內容與中繼資料；`output` 控制大型頁面是否寫入暫存檔
- `list_wiki_pages` - 取得 Wiki 頁面樹狀結構（支援 recursionLevel）；`detail: "minimal"`（預設）不含頁面內容，`full` 回完整 Markdown
- `create_wiki_page` - 在指定 Wiki 中建立新頁面或子頁面（CodeWiki 須指定 branch）；`contentFile` 傳本機路徑可節省 output token
- `update_wiki_page` - 更新 Wiki 現有頁面內容（自動取得 ETag，無需手動傳入）；`contentFile` 傳本機路徑可節省 output token
- `delete_wiki_page` - 刪除 Wiki 指定頁面（CodeWiki 須指定 branch）
- `search_wiki` - 依關鍵字全文搜尋 Wiki 頁面（project 參數限填名稱，不支援 ID）

## 需求條件

- Node.js 18+ 或 Bun
- Azure DevOps Server (On-Premise) 實例
- 有效的 Personal Access Token

## 快速開始

參考下方設定說明，將 MCP Server 加入你使用的 AI 工具。

## GitHub Copilot (VS Code) MCP 設定

1. 在 VS Code 中開啟命令面板 (`Cmd/Ctrl + Shift + P`)
2. 執行 `MCP: Open User Configuration`
3. 將以下配置貼入：

```json
{
  "inputs": [
    {
      "id": "azureDevOpsUrl",
      "type": "promptString",
      "description": "Azure DevOps Server URL，例如 https://my-server/DefaultCollection",
      "default": ""
    },
    {
      "id": "azureDevOpsToken",
      "type": "promptString",
      "description": "Azure DevOps Personal Access Token",
      "default": ""
    }
  ],
  "servers": {
    "azure-devops-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@cb/ado-server-mcp"],
      "env": {
        "AZURE_DEVOPS_URL": "${input:azureDevOpsUrl}",
        "AZURE_DEVOPS_TOKEN": "${input:azureDevOpsToken}",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

## Claude Code MCP 設定

在 `~/.claude.json` 的根層加入 `mcpServers`，設定後對所有專案生效：

```json
{
  "mcpServers": {
    "azure-devops-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@cb/ado-server-mcp"],
      "env": {
        "AZURE_DEVOPS_URL": "https://my-server/DefaultCollection",
        "AZURE_DEVOPS_TOKEN": "your-pat-token",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

或直接使用 CLI 新增（效果相同）：

```bash
claude mcp add --scope user azure-devops-server \
  -e AZURE_DEVOPS_URL=https://my-server/DefaultCollection \
  -e AZURE_DEVOPS_TOKEN=your-pat-token \
  -e NODE_TLS_REJECT_UNAUTHORIZED=0 \
  -- npx -y @cb/ado-server-mcp
```

## 開發

### 設置開發環境

```bash
bun install
```

### 環境變數

在開發時，則需要建立 `.env` 檔案，置入以下變數：

| 變數名                         | 說明                                                 | 示例                                                |
| ------------------------------ | ---------------------------------------------------- | --------------------------------------------------- |
| `AZURE_DEVOPS_URL`             | Azure DevOps Server 的完整 URL，包含 collection 路徑 | `http://my-local-server:8080/tfs/DefaultCollection` |
| `AZURE_DEVOPS_TOKEN`           | Personal Access Token，用於 API 認證                 | `[your-pat-token]`                                  |
| `NODE_TLS_REJECT_UNAUTHORIZED` | 若使用自簽章 HTTPS，設定爲 `0` 以允許繞過驗證        | `0` 或 `1` (預設)                                   |

### 本機 MCP 設定

開發時可將 AI 工具指向本機 `bun start`，環境變數由 `.env` 自動載入，無需額外設定。

**GitHub Copilot (VS Code)**：加入 MCP User Configuration：

```json
{
  "servers": {
    "azure-devops-server-dev": {
      "type": "stdio",
      "command": "bun",
      "args": ["start"]
    }
  }
}
```

**Claude Code**：

```bash
claude mcp add azure-devops-server-dev -- bun start
```

### 常用命令

| 命令            | 說明                                                            |
| --------------- | --------------------------------------------------------------- |
| `bun start`     | 直接啟動 MCP server (開發用)                                    |
| `bun run build` | 編譯 TypeScript 為 Node.js 可執行的 JavaScript，輸出到 `./dist` |

> **發佈前注意**：發佈到 registry 前必須先執行 `bun run build`，確保 `dist/` 為最新版本。

### 專案結構

```
src/
├── index.ts              # MCP server 入口點
├── client.ts             # Azure DevOps API 客戶端
├── types/
│   └── azureDevOps.ts    # 類型定義
└── tools/
    ├── projects.ts       # 專案相關工具
    ├── pullRequests.ts   # 拉取請求相關工具
    ├── workItems.ts      # 工作項相關工具
    ├── iterations.ts     # Iteration 管理工具
    ├── pipelines.ts      # Pipeline 相關工具
    ├── wiki.ts           # Wiki 相關工具
    └── git.ts            # Git 相關工具
```

## License

MIT
