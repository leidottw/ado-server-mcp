import type { AxiosInstance } from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

const workItemIdSchema = z.union([
  z.string().regex(/^\d+$/).transform(Number),
  z.number().int().positive(),
]);

export function registerWorkItemTools(
  server: McpServer,
  client: AxiosInstance,
): void {
  server.registerTool(
    "get_work_item",
    {
      description: "取得單一工作項目詳細資料，包括已清理的指派者資訊",
      inputSchema: {
        id: workItemIdSchema.describe("工作項目編號"),
      },
      outputSchema: z.object({
        id: z.number().nullable(),
        title: z.string().nullable(),
        state: z.string().nullable(),
        assignedTo: z.string().nullable(),
        fields: z.record(z.string(), z.any()),
        url: z.string().nullable(),
      }),
    },
    async ({ id }: { id: number }) => {
      const response = await client.get(`wit/workitems/${id}`);
      const fields = response.data?.fields ?? {};
      const assignedToRaw = fields["System.AssignedTo"];
      return {
        content: [],
        structuredContent: {
          id: response.data?.id,
          title: fields["System.Title"],
          state: fields["System.State"],
          assignedTo: cleanAssignedTo(assignedToRaw),
          fields,
          url: response.data?.url ?? null,
        },
      };
    },
  );

  server.registerTool(
    "create_work_item",
    {
      description: "建立新的工作項目，使用 On-Premise 所需的 JSON Patch 格式",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        type: z.string().min(1).describe("工作項目類型，例如 Bug 或 Task"),
        fields: z
          .record(z.string(), z.any())
          .describe("欄位名稱與對應值的物件"),
      },
      outputSchema: z.object({
        id: z.number().nullable(),
        url: z.string().nullable(),
        fields: z.record(z.string(), z.any()),
      }),
    },
    async ({
      project,
      type,
      fields,
    }: {
      project: string;
      type: string;
      fields: Record<string, unknown>;
    }) => {
      const operations = Object.entries(fields).map(([path, value]) => ({
        op: "add",
        path: `/fields/${path}`,
        value,
      }));
      const response = await client.post(
        `wit/workitems/$${encodeURIComponent(type)}`,
        operations,
        {
          headers: {
            "Content-Type": "application/json-patch+json",
          },
          params: {
            project,
          },
        },
      );
      return {
        content: [],
        structuredContent: {
          id: response.data?.id,
          url: response.data?.url ?? null,
          fields: response.data?.fields ?? {},
        },
      };
    },
  );

  server.registerTool(
    "update_work_item",
    {
      description: "更新工作項目欄位或工作流程狀態，支援自訂狀態欄位",
      inputSchema: {
        id: workItemIdSchema.describe("工作項目編號"),
        state: z.string().optional().describe("新的工作項目狀態"),
        fields: z
          .record(z.string(), z.any())
          .optional()
          .describe("要更新的欄位資料"),
      },
      outputSchema: z.object({
        id: z.number().nullable(),
        state: z.string().nullable(),
        fields: z.record(z.string(), z.any()),
        url: z.string().nullable(),
      }),
    },
    async ({
      id,
      state,
      fields,
    }: {
      id: number;
      state?: string;
      fields?: Record<string, unknown>;
    }) => {
      const operations = [] as Array<Record<string, unknown>>;
      if (state) {
        operations.push({
          op: "add",
          path: "/fields/System.State",
          value: state,
        });
      }
      if (fields) {
        for (const [path, value] of Object.entries(fields)) {
          operations.push({ op: "add", path: `/fields/${path}`, value });
        }
      }
      if (operations.length === 0) {
        throw new Error("至少需要提供 state 或 fields 其中一個屬性進行更新。");
      }
      const response = await client.patch(`wit/workitems/${id}`, operations, {
        headers: {
          "Content-Type": "application/json-patch+json",
        },
      });
      return {
        content: [],
        structuredContent: {
          id: response.data?.id,
          state: response.data?.fields?.["System.State"],
          fields: response.data?.fields ?? {},
          url: response.data?.url ?? null,
        },
      };
    },
  );

  server.registerTool(
    "query_work_items",
    {
      description: "使用 WIQL 查詢工作項目，可支援進階 On-Premise 查詢情境",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("專案名稱或 ID，若留空則使用預設 Collection"),
        wiql: z.string().min(1).describe("WIQL 查詢字串"),
      },
      outputSchema: z.object({
        query: z.string(),
        workItems: z.array(
          z.object({
            id: z.number().nullable(),
            url: z.string().nullable(),
          }),
        ),
      }),
    },
    async ({ project, wiql }: { project?: string; wiql: string }) => {
      const response = await client.post(
        "wit/wiql",
        { query: wiql },
        {
          params: project ? { project } : undefined,
        },
      );
      return {
        content: [],
        structuredContent: {
          query: wiql,
          workItems: (response.data?.workItems ?? []).map((item: any) => ({
            id: item.id,
            url: item.url,
          })),
        },
      };
    },
  );
}

function cleanAssignedTo(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/<.*>$/, "").trim();
    return cleaned;
  }
  if (typeof value === "object" && value !== null) {
    const candidate =
      (value as Record<string, unknown>)["displayName"] ??
      (value as Record<string, unknown>)["uniqueName"] ??
      (value as Record<string, unknown>)["descriptor"];
    if (typeof candidate === "string") {
      return candidate;
    }
  }
  console.error("無法解析 System.AssignedTo 欄位的身份資料", value);
  return undefined;
}
