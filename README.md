# Azure DevOps Server MCP

本專案是為 Azure DevOps Server (On-Premise) 建置的自訂 MCP Server，使用 Bun 作為執行環境與打包工具。

## 快速開始

1. 安裝依賴

```bash
bun install
```

2. 複製並填寫 `.env`

```bash
cp .env.example .env
```

3. 產生 VS Code 全域 MCP 設定

```bash
bun run src/scripts/gen-config.ts
```

4. 若使用 Node 版本執行，先編譯

```bash
bun run build
```

## .env 變數說明

- `AZURE_DEVOPS_URL`
  - Azure DevOps Server 的完整 URL，包含 collection 路徑，例如 `http://my-local-server:8080/tfs/DefaultCollection`
- `AZURE_DEVOPS_TOKEN`
  - Personal Access Token，用於 Basic Auth
- `AZURE_DEVOPS_API_VERSION`
  - API 版本，預設 `7.1`
- `NODE_TLS_REJECT_UNAUTHORIZED`
  - 若使用自簽章 HTTPS，設定 `0` 以允許繞過驗證

## 全域 VS Code MCP 設定

`src/scripts/gen-config.ts` 會讀取專案根目錄下的 `.env`，並自動將 `azure-devops-server-mcp` 註冊到以下路徑：

- macOS / Linux: `~/.vscode/mcp.json`
- Windows: `%USERPROFILE%\.vscode\mcp.json`

若系統可用 Bun，會使用：

```json
{
  "command": "bun",
  "args": ["run", "/absolute/path/to/project/src/index.ts"]
}
```

否則會改為：

```json
{
  "command": "node",
  "args": ["/absolute/path/to/project/dist/index.js"]
}
```

## VS Code 偵錯設定

已在 `.vscode/launch.json` 中註冊 `Launch Azure DevOps Server MCP`。
此設定會使用 Bun 啟動 `src/index.ts`，並從 `.env` 中載入環境變數。

## Bun 腳本

- `bun run build`
  - 針對 Node 目標建置 `src/index.ts` 到 `./dist`
- `bun run gen-config`
  - 讀取 `.env` 並更新全域 VS Code `mcp.json`
