#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAzureDevOpsClient } from "./client.js";
import { registerIterationTools } from "./tools/iterations.js";
import { registerPipelineTools } from "./tools/pipelines.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerPullRequestTools } from "./tools/pullRequests.js";
import { registerWikiTools } from "./tools/wiki.js";
import { registerWorkItemTools } from "./tools/workItems.js";
import { version } from "../package.json";

async function main(): Promise<void> {
  const client = await getAzureDevOpsClient();
  const mcpServer = new McpServer({
    name: "azure-devops-server-mcp",
    version,
  });

  registerWorkItemTools(mcpServer, client.wit);
  registerIterationTools(mcpServer, client.wit, client.work);
  registerPullRequestTools(mcpServer, client.git);
  registerProjectTools(mcpServer, client.core, client.connect);
  registerPipelineTools(mcpServer, client.build, client.git);
  registerWikiTools(mcpServer, client.wiki);

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
