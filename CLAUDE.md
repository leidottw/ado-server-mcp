# ado-server-mcp 專案指引

## 實作慣例（違反任一項視為實作錯誤）

| 慣例      | 說明                                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 註冊模式  | 每個領域一個 `src/tools/<domain>.ts`，export `register<Domain>Tools(server, ...apis)`，於 `src/index.ts` 呼叫                       |
| Tool 註冊 | 一律用 `server.registerTool(name, { description, inputSchema, outputSchema }, handler)`                                             |
| 回傳格式  | `return { content: [], structuredContent: {...} }`，**content 保持空陣列**，不要把 JSON 重複塞進 text content                       |
| Schema    | input 用 zod raw shape；output schema 定義於 `src/types/azureDevOps.ts`，命名 `<toolName>OutputSchema`                              |
| 資料清理  | 回傳前用 `ensureArray()` / `ensureRecord()` 防禦 undefined，日期經 `normalizeAzureDevOpsDates()`                                    |
| 欄位映射  | 不直接回傳 API 原始物件，逐欄位挑選（參考 `mapBuild()`），未定義值轉 `undefined`                                                    |
| 描述語言  | description 與 zod `.describe()` 一律正體中文（台灣慣用語），專有名詞保留英文                                                       |
| 命名      | tool 名稱用 `snake_case` 動詞開頭：`get_` / `list_` / `create_` / `update_` / `delete_` / `add_` / `remove_` / `queue_` / `search_` |
| 版本      | 依 SemVer：新增 tool 升 MINOR；既有 tool 行為不相容變更升 MAJOR。同步更新 `CHANGELOG.md`（Keep a Changelog）與 `README.md` 功能清單 |
| 目標環境  | **On-Premise ADO Server**，不可使用僅 Azure DevOps Services（雲端）才有的 API                                                       |

## 實作注意事項

1. `azure-devops-node-api` 的 GitApi 方法參數極多且順序敏感（參考既有程式碼大量 `undefined` 佔位的寫法），**修改前先讀 `node_modules` 內的 `.d.ts` 確認簽名**，不要憑記憶猜參數位置。

2. On-Premise 版本可能不支援部分新 API（如 timeline 某些欄位）。所有映射一律 `?? undefined` 防禦，缺欄位不可拋錯。

3. `getItemText` 回傳 `Promise<NodeJS.ReadableStream>`，需收集為字串（專案內共用 `streamToString()` helper 定義於 `src/tools/git.ts`）。

4. zod schema：inputSchema 是 **raw shape**（物件字面值），不是 `z.object()`；outputSchema 同理。照既有檔案的形式。

5. 新增 npm 套件用 `bun add`，並確認 `bun run build` 打包無誤。

6. 任何工具都不得在錯誤訊息或暫存檔名中洩漏 `AZURE_DEVOPS_TOKEN`。

7. 暫存檔**不寫入** repo 工作目錄，一律寫至 `os.tmpdir()/ado-mcp/`，避免污染 git status。

## 版控指引

| 時機 | 動作 |
| --- | --- |
| 功能實作 commit | 將變更摘要更新至 `CHANGELOG.md` 的 `[Unreleased]` 區塊 |
| 發布 beta 升版 | 在 `[Unreleased]` 下方新增 beta 版號區塊（如 `[0.8.0-beta.1]`）並將內容移入；`[Unreleased]` 保留於頂端（可為空）；更新 `package.json` 版本 |
| 發布正式版升版 | 將 `[Unreleased]` 內容（若有）與最後一個 beta 區塊合併，改為正式版號區塊（如 `[0.8.0]`）；`[Unreleased]` 保留於頂端（可為空）；同步更新 `README.md` 功能清單與 `package.json` 版本 |
