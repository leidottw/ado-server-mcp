# Azure DevOps Server MCP

本專案是為 Azure DevOps Server (On-Premise) 建置的自訂 MCP (Model Context Protocol) Server，使用 Bun 作為執行環境與打包工具。

## 功能

### 工作項管理

- `get_work_item` - 取得單一工作項目詳細資料
- `create_work_item` - 建立新的工作項目
- `update_work_item` - 更新工作項目欄位或工作流程狀態
- `query_work_items` - 使用 WIQL 查詢工作項目
- `get_work_items_batch` - 批次取得多個工作項目的詳細資料
- `list_work_item_types` - 列出專案中可用的工作項目類型
- `add_work_item_comment` - 在工作項目上新增評論

### 拉取請求管理

- `get_repositories` - 列出指定專案內的 Git 儲存庫
- `get_pull_requests` - 取得指定專案下的 Git 拉取請求
- `get_pull_request_details` - 取得單一拉取請求詳細資訊與對話串內容
- `create_pull_request` - 建立新的拉取請求
- `create_pull_request_comment` - 在拉取請求上建立新評論回覆串
- `update_pull_request` - 更新拉取請求

### 專案管理

- `list_projects` - 列出 Collection 中可存取的專案清單
- `get_project` - 取得單一專案的詳細資訊
- `get_project_teams` - 取得指定專案底下的團隊列表
- `get_team` - 取得特定團隊的詳細資訊
- `get_team_members` - 取得特定團隊的成員列表

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
    "azure-devops-server-mcp": {
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
    "azure-devops-server-mcp": {
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
claude mcp add --scope user azure-devops-server-mcp \
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

### 常用命令

| 命令            | 說明                                                            |
| --------------- | --------------------------------------------------------------- |
| `bun start`     | 直接啟動 MCP server (開發用)                                    |
| `bun run build` | 編譯 TypeScript 為 Node.js 可執行的 JavaScript，輸出到 `./dist` |

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
    └── workItems.ts      # 工作項相關工具
```

## License

MIT
