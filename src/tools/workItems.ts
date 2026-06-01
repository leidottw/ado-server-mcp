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
  batchWorkItemsOutputSchemaByVersion,
  workItemTypesOutputSchemaByVersion,
  addWorkItemCommentOutputSchemaByVersion,
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
        bypassRules: z
          .boolean()
          .optional()
          .describe("略過工作項目規則驗證"),
        suppressNotifications: z
          .boolean()
          .optional()
          .describe("建立後不發送通知"),
      },
      outputSchema:
        createWorkItemOutputSchemaByVersion[apiVersion as SupportedApiVersion],
    },
    async ({
      project,
      type,
      fields,
      bypassRules,
      suppressNotifications,
    }: {
      project: string;
      type: string;
      fields: Record<string, unknown>;
      bypassRules?: boolean;
      suppressNotifications?: boolean;
    }) => {
      const operations = Object.entries(fields).map(([fieldKey, value]) => ({
        op: "add",
        path: fieldKey.startsWith("/fields/")
          ? fieldKey
          : `/fields/${fieldKey}`,
        value,
      }));
      const queryParams: Record<string, unknown> = { project };
      if (bypassRules !== undefined) queryParams["bypassRules"] = bypassRules;
      if (suppressNotifications !== undefined)
        queryParams["suppressNotifications"] = suppressNotifications;
      const response = await client.post(
        `wit/workitems/$${encodeURIComponent(type)}`,
        operations,
        {
          headers: { "Content-Type": "application/json-patch+json" },
          params: queryParams,
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
        addRelations: z
          .array(
            z.object({
              rel: z
                .string()
                .describe("關聯類型，例如 System.LinkTypes.Hierarchy-Reverse"),
              url: z.string().describe("目標工作項目的 URL"),
              attributes: z
                .record(z.string(), z.unknown())
                .optional()
                .describe("關聯屬性，例如 comment"),
            }),
          )
          .optional()
          .describe("要新增的關聯清單"),
        bypassRules: z.boolean().optional().describe("略過工作項目規則驗證"),
        suppressNotifications: z
          .boolean()
          .optional()
          .describe("更新後不發送通知"),
      },
      outputSchema:
        updateWorkItemOutputSchemaByVersion[apiVersion as SupportedApiVersion],
    },
    async ({
      id,
      state,
      fields,
      addRelations,
      bypassRules,
      suppressNotifications,
    }: {
      id: number;
      state?: string;
      fields?: Record<string, unknown>;
      addRelations?: Array<{
        rel: string;
        url: string;
        attributes?: Record<string, unknown>;
      }>;
      bypassRules?: boolean;
      suppressNotifications?: boolean;
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
      if (addRelations) {
        for (const relation of addRelations) {
          operations.push({
            op: "add",
            path: "/relations/-",
            value: {
              rel: relation.rel,
              url: relation.url,
              attributes: relation.attributes ?? {},
            },
          });
        }
      }
      if (operations.length === 0) {
        throw new Error(
          "至少需要提供 state、fields 或 addRelations 其中一個屬性進行更新。",
        );
      }
      const queryParams: Record<string, unknown> = {};
      if (bypassRules !== undefined) queryParams["bypassRules"] = bypassRules;
      if (suppressNotifications !== undefined)
        queryParams["suppressNotifications"] = suppressNotifications;
      const response = await client.patch(
        `wit/workitems/${id}`,
        operations,
        {
          headers: { "Content-Type": "application/json-patch+json" },
          params:
            Object.keys(queryParams).length > 0 ? queryParams : undefined,
        },
      );
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
        top: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("最多回傳幾筆結果"),
      },
      outputSchema:
        queryWorkItemsOutputSchemaByVersion[apiVersion as SupportedApiVersion],
    },
    async ({
      project,
      wiql,
      top,
    }: {
      project?: string;
      wiql: string;
      top?: number;
    }) => {
      const params: Record<string, unknown> = {};
      if (project) params["project"] = project;
      if (top !== undefined) params["$top"] = top;
      const response = await client.post(
        "wit/wiql",
        { query: wiql },
        { params: Object.keys(params).length > 0 ? params : undefined },
      );
      const wiqlResult = response.data as AzureDevOpsWiqlResult;
      const workItems = ensureArray<{ id?: number; url?: string }>(
        wiqlResult.workItems,
      );
      const workItemRelations = ensureArray<{
        rel?: string;
        source?: { id?: number; url?: string };
        target?: { id?: number; url?: string };
      }>(wiqlResult.workItemRelations);
      return {
        content: [],
        structuredContent: {
          query: wiql,
          queryResultUrl: wiqlResult.queryResultUrl ?? null,
          workItems: workItems.map((item) => ({
            id: item.id ?? null,
            url: item.url ?? null,
          })),
          workItemRelations: workItemRelations.map((rel) => ({
            rel: rel.rel ?? null,
            source: rel.source
              ? { id: rel.source.id ?? null, url: rel.source.url ?? null }
              : null,
            target: rel.target
              ? { id: rel.target.id ?? null, url: rel.target.url ?? null }
              : null,
          })),
        },
      };
    },
  );
  server.registerTool(
    "get_work_items_batch",
    {
      description: "批次取得多個工作項目的詳細資料",
      inputSchema: {
        ids: z
          .array(z.number().int().positive())
          .min(1)
          .describe("工作項目編號清單"),
        fields: z
          .array(z.string())
          .optional()
          .describe("要回傳的欄位清單，留空則回傳所有欄位"),
        project: z.string().optional().describe("專案名稱或 ID"),
      },
      outputSchema:
        batchWorkItemsOutputSchemaByVersion[apiVersion as SupportedApiVersion],
    },
    async ({
      ids,
      fields,
      project,
    }: {
      ids: number[];
      fields?: string[];
      project?: string;
    }) => {
      const body: Record<string, unknown> = { ids };
      if (fields && fields.length > 0) body["fields"] = fields;
      const response = await client.post("wit/workitemsbatch", body, {
        params: project ? { project } : undefined,
      });
      const workItems = ensureArray<{
        id?: number;
        rev?: number;
        fields?: Record<string, unknown>;
        url?: string;
      }>(response.data?.value);
      return {
        content: [],
        structuredContent: {
          workItems: workItems.map((item) => ({
            id: item.id ?? null,
            rev: item.rev ?? null,
            fields: item.fields ?? {},
            url: item.url ?? null,
          })),
        },
      };
    },
  );

  server.registerTool(
    "list_work_item_types",
    {
      description: "列出專案中可用的工作項目類型",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
      },
      outputSchema:
        workItemTypesOutputSchemaByVersion[apiVersion as SupportedApiVersion],
    },
    async ({ project }: { project: string }) => {
      const response = await client.get("wit/workitemtypes", {
        params: { project },
      });
      const types = ensureArray<{
        name?: string;
        description?: string;
        url?: string;
      }>(response.data?.value);
      return {
        content: [],
        structuredContent: {
          workItemTypes: types.map((t) => ({
            name: t.name ?? null,
            description: t.description ?? null,
            url: t.url ?? null,
          })),
        },
      };
    },
  );

  server.registerTool(
    "add_work_item_comment",
    {
      description: "在工作項目上新增評論",
      inputSchema: {
        id: workItemIdSchema.describe("工作項目編號"),
        text: z.string().min(1).describe("評論內容（支援 Markdown）"),
        project: z.string().optional().describe("專案名稱或 ID"),
      },
      outputSchema:
        addWorkItemCommentOutputSchemaByVersion[
          apiVersion as SupportedApiVersion
        ],
    },
    async ({
      id,
      text,
      project,
    }: {
      id: number;
      text: string;
      project?: string;
    }) => {
      const response = await client.post(
        `wit/workitems/${id}/comments`,
        { text },
        { params: project ? { project } : undefined },
      );
      return {
        content: [],
        structuredContent: {
          id: response.data?.id ?? null,
          text: response.data?.text ?? null,
          createdDate: response.data?.createdDate ?? null,
          url: response.data?.url ?? null,
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
