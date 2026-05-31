import type { AxiosInstance } from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { apiVersion } from "../client.js";
import type {
  AzureDevOpsWorkItem,
  AzureDevOpsWorkItemRelation,
  AzureDevOpsWiqlResult,
  SupportedApiVersion,
} from "../types/azureDevOps.js";
import {
  ensureArray,
  ensureRecord,
  createWorkItemOutputSchemaByVersion,
  queryWorkItemsOutputSchemaByVersion,
  updateWorkItemOutputSchemaByVersion,
  workItemOutputSchemaByVersion,
} from "../types/azureDevOps.js";

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
      outputSchema:
        workItemOutputSchemaByVersion[apiVersion as SupportedApiVersion],
    },
    async ({ id }: { id: number }) => {
      const response = await client.get(`wit/workitems/${id}`);
      const rawFields = response.data?.fields;
      const fields = ensureRecord(rawFields);
      const assignedToRaw = fields["System.AssignedTo"];
      const relations = ensureArray<AzureDevOpsWorkItemRelation>(
        response.data?.relations,
      );
      return {
        content: [],
        structuredContent: {
          id: response.data?.id,
          rev: response.data?.rev,
          title: fields["System.Title"] ?? null,
          state: fields["System.State"] ?? null,
          assignedTo: cleanAssignedTo(assignedToRaw),
          fields,
          relations,
          _links: response.data?._links ?? null,
          commentVersionRef: response.data?.commentVersionRef ?? null,
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
          .record(z.string(), z.unknown())
          .describe("欄位名稱與對應值的物件"),
      },
      outputSchema:
        createWorkItemOutputSchemaByVersion[apiVersion as SupportedApiVersion],
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
      const operations = Object.entries(fields).map(([fieldKey, value]) => ({
        op: "add",
        path: fieldKey.startsWith("/fields/")
          ? fieldKey
          : `/fields/${fieldKey}`,
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
          rev: response.data?.rev,
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
          .record(z.string(), z.unknown())
          .optional()
          .describe("要更新的欄位資料"),
      },
      outputSchema:
        updateWorkItemOutputSchemaByVersion[apiVersion as SupportedApiVersion],
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
          op: "replace",
          path: "/fields/System.State",
          value: state,
        });
      }
      if (fields) {
        for (const [fieldKey, value] of Object.entries(fields)) {
          operations.push({
            op: "replace",
            path: fieldKey.startsWith("/fields/")
              ? fieldKey
              : `/fields/${fieldKey}`,
            value,
          });
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
          rev: response.data?.rev,
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
      outputSchema:
        queryWorkItemsOutputSchemaByVersion[apiVersion as SupportedApiVersion],
    },
    async ({ project, wiql }: { project?: string; wiql: string }) => {
      const response = await client.post(
        "wit/wiql",
        { query: wiql },
        {
          params: project ? { project } : undefined,
        },
      );
      const wiqlResult = response.data as AzureDevOpsWiqlResult;
      const workItems = ensureArray<{ id?: number; url?: string }>(
        wiqlResult.workItems,
      );
      return {
        content: [],
        structuredContent: {
          query: wiql,
          queryResultUrl: wiqlResult.queryResultUrl ?? null,
          workItems: workItems.map((item) => ({
            id: item.id ?? null,
            url: item.url ?? null,
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
