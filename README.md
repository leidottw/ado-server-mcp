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

3. 產生 VS Code 工作區 MCP 設定

```bash
bun run src/scripts/gen-config.ts
```

或在執行目錄使用 npx：

```bash
npx . gen-config
```

如果直接執行 `npx .`，會顯示 help。

4. 若使用 Node 版本執行，先編譯

```bash
bun run build
```

## .env 變數說明

- `AZURE_DEVOPS_URL`
  - Azure DevOps Server 的完整 URL，包含 collection 路徑，例如 `http://my-local-server:8080/tfs/DefaultCollection`
- `AZURE_DEVOPS_TOKEN`
  - Personal Access Token，用於 Basic Auth
- `NODE_TLS_REJECT_UNAUTHORIZED`
  - 若使用自簽章 HTTPS，設定 `0` 以允許繞過驗證

> `.env.example` 僅供參考，建議在需要直接啟動 `src/index.ts` 或用 VS Code `launch.json` 偵錯時才建立 `.env`。

## 全域 VS Code MCP 設定

`src/scripts/gen-config.ts` 會將必要的 Azure DevOps 設定寫入 `.vscode/mcp.json`，並使用 VS Code `inputs` 綁定：

- `AZURE_DEVOPS_URL` → `${input:azureDevOpsUrl}`
- `AZURE_DEVOPS_TOKEN` → `${input:azureDevOpsToken}`
- `NODE_TLS_REJECT_UNAUTHORIZED` → `${input:nodeTlsRejectUnauthorized}`

生成的 `.vscode/mcp.json` 會以 `node ./dist/index.js` 執行 MCP Server。請先執行 `bun run build` 產生 `dist/index.js`，該 build 檔案會提交到版本庫。

```

## VS Code 偵錯設定

已在 `.vscode/launch.json` 中註冊 `Launch Azure DevOps Server MCP`。
此設定會使用 Bun 啟動 `src/index.ts`，並從 `.env` 中載入環境變數。

## Bun 腳本

- `bun run build`
  - 針對 Node 目標建置 `src/index.ts` 到 `./dist`
- `bun run gen-config`
  - 生成或更新工作區 `.vscode/mcp.json`
```
