import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { getAzureDevOpsClient } from "./client.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerPullRequestTools } from "./tools/pullRequests.js";
import { registerWorkItemTools } from "./tools/workItems.js";

async function main(): Promise<void> {
  const client = getAzureDevOpsClient();
  const mcpServer = new McpServer({
    name: "azure-devops-server-mcp",
    version: "1.0.0",
  });

  registerWorkItemTools(mcpServer, client);
  registerPullRequestTools(mcpServer, client);
  registerProjectTools(mcpServer, client);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  process.on("uncaughtException", (error) => {
    console.error("未處理的例外：", error);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("未處理的 Promise 拒絕：", reason);
  });

  process.on("SIGINT", async () => {
    try {
      await mcpServer.close();
    } catch (error) {
      console.error("終止時關閉 MCP Server 發生錯誤：", error);
    } finally {
      process.exit(0);
    }
  });
}

main().catch((error) => {
  console.error("MCP Server 啟動失敗：", error);
  process.exit(1);
});
