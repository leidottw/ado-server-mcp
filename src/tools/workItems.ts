import type { IWorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi";
import type * as WorkItemTrackingInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";
import type * as CoreInterfaces from "azure-devops-node-api/interfaces/CoreInterfaces";
import * as VSSInterfaces from "azure-devops-node-api/interfaces/common/VSSInterfaces";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  ensureArray,
  ensureRecord,
  normalizeAzureDevOpsDates,
  createWorkItemOutputSchema,
  queryWorkItemsOutputSchema,
  updateWorkItemOutputSchema,
  workItemOutputSchema,
  batchWorkItemsOutputSchema,
  workItemTypesOutputSchema,
  addWorkItemCommentOutputSchema,
} from "../types/azureDevOps.js";

const workItemIdSchema = z.union([
  z.string().regex(/^\d+$/).transform(Number),
  z.number().int().positive(),
]);

export function registerWorkItemTools(
  server: McpServer,
  witApi: IWorkItemTrackingApi,
): void {
  server.registerTool(
    "get_work_item",
    {
      description: "取得單一工作項目詳細資料，包括已清理的指派者資訊",
      inputSchema: {
        id: workItemIdSchema.describe("工作項目編號"),
        fields: z
          .array(z.string())
          .optional()
          .describe(
            "要回傳的欄位 referenceName 清單，留空則回傳所有欄位。" +
              "常用欄位：System.Id, System.Title, System.State, System.AssignedTo, " +
              "System.WorkItemType, System.Description, System.AreaPath, System.IterationPath, " +
              "System.Tags, System.CreatedDate, System.CreatedBy, System.ChangedDate, System.ChangedBy, " +
              "System.CommentCount, Microsoft.VSTS.Common.Priority, Microsoft.VSTS.Common.Severity, " +
              "Microsoft.VSTS.Common.AcceptanceCriteria, Microsoft.VSTS.Scheduling.StoryPoints, " +
              "Microsoft.VSTS.Scheduling.RemainingWork, Microsoft.VSTS.Scheduling.CompletedWork",
          ),
      },
      outputSchema: workItemOutputSchema,
    },
    async ({ id, fields }: { id: number; fields?: string[] }) => {
      const response = await witApi.getWorkItem(id, fields);
      const rawFields = response?.fields;
      const responseFields = ensureRecord(rawFields);
      const assignedToRaw = responseFields["System.AssignedTo"];
      const relations =
        ensureArray<WorkItemTrackingInterfaces.WorkItemRelation>(
          response?.relations,
        );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          id: response?.id,
          rev: response?.rev,
          title: responseFields["System.Title"] ?? undefined,
          state: responseFields["System.State"] ?? undefined,
          assignedTo: cleanAssignedTo(assignedToRaw),
          fields: responseFields,
          relations,
          _links: response?._links ?? undefined,
          commentVersionRef: response?.commentVersionRef ?? undefined,
          url: response?.url ?? undefined,
        }),
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
        bypassRules: z.boolean().optional().describe("略過工作項目規則驗證"),
        suppressNotifications: z
          .boolean()
          .optional()
          .describe("建立後不發送通知"),
      },
      outputSchema: createWorkItemOutputSchema,
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
      const operations: VSSInterfaces.JsonPatchOperation[] = Object.entries(
        fields,
      ).map(([fieldKey, value]) => ({
        op: VSSInterfaces.Operation.Add,
        path: fieldKey.startsWith("/fields/")
          ? fieldKey
          : `/fields/${fieldKey}`,
        value,
      }));
      const response = await witApi.createWorkItem(
        undefined,
        operations,
        project,
        type,
        undefined,
        bypassRules,
        suppressNotifications,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          id: response?.id,
          rev: response?.rev,
          url: response?.url ?? undefined,
          fields: response?.fields ?? {},
        }),
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
      outputSchema: updateWorkItemOutputSchema,
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
      const operations: VSSInterfaces.JsonPatchOperation[] = [];
      if (state) {
        operations.push({
          op: VSSInterfaces.Operation.Replace,
          path: "/fields/System.State",
          value: state,
        });
      }
      if (fields) {
        for (const [fieldKey, value] of Object.entries(fields)) {
          operations.push({
            op: VSSInterfaces.Operation.Replace,
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
            op: VSSInterfaces.Operation.Add,
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
      const response = await witApi.updateWorkItem(
        undefined,
        operations,
        id,
        undefined,
        undefined,
        bypassRules,
        suppressNotifications,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          id: response?.id,
          rev: response?.rev,
          state: response?.fields?.["System.State"],
          fields: response?.fields ?? {},
          url: response?.url ?? undefined,
        }),
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
      outputSchema: queryWorkItemsOutputSchema,
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
      const teamContext: CoreInterfaces.TeamContext | undefined = project
        ? { project }
        : undefined;
      const wiqlResult = await witApi.queryByWiql(
        { query: wiql },
        teamContext,
        undefined,
        top,
      );
      const workItems = ensureArray<{ id?: number; url?: string }>(
        wiqlResult.workItems,
      );
      const columns = ensureArray<{
        referenceName?: string;
        name?: string;
        url?: string;
      }>(wiqlResult.columns);
      const workItemRelations = ensureArray<{
        rel?: string;
        source?: { id?: number; url?: string };
        target?: { id?: number; url?: string };
      }>(wiqlResult.workItemRelations);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          asOf: wiqlResult.asOf ?? undefined,
          columns: columns.map((column) => ({
            referenceName: column.referenceName ?? undefined,
            name: column.name ?? undefined,
            url: column.url ?? undefined,
          })),
          query: wiql,
          queryResultType: wiqlResult.queryResultType ?? undefined,
          queryType: wiqlResult.queryType ?? undefined,
          queryResultUrl: undefined,
          sortColumns: wiqlResult.sortColumns ?? undefined,
          workItems: workItems.map((item) => ({
            id: item.id ?? undefined,
            url: item.url ?? undefined,
          })),
          workItemRelations: workItemRelations.map((rel) => ({
            rel: rel.rel ?? undefined,
            source: rel.source
              ? {
                  id: rel.source.id ?? undefined,
                  url: rel.source.url ?? undefined,
                }
              : undefined,
            target: rel.target
              ? {
                  id: rel.target.id ?? undefined,
                  url: rel.target.url ?? undefined,
                }
              : undefined,
          })),
        }),
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
      outputSchema: batchWorkItemsOutputSchema,
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
      const workItems = await witApi.getWorkItems(
        ids,
        fields,
        undefined,
        undefined,
        undefined,
        project,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          workItems: ensureArray(workItems).map((item: any) => ({
            id: item.id ?? undefined,
            rev: item.rev ?? undefined,
            fields: item.fields ?? {},
            url: item.url ?? undefined,
          })),
        }),
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
      outputSchema: workItemTypesOutputSchema,
    },
    async ({ project }: { project: string }) => {
      const types = await witApi.getWorkItemTypes(project);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          workItemTypes: ensureArray(types).map((t: any) => ({
            name: t.name ?? undefined,
            description: t.description ?? undefined,
            url: t.url ?? undefined,
          })),
        }),
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
        project: z.string().describe("專案名稱或 ID"),
      },
      outputSchema: addWorkItemCommentOutputSchema,
    },
    async ({
      id,
      text,
      project,
    }: {
      id: number;
      text: string;
      project: string;
    }) => {
      const commentCreate: WorkItemTrackingInterfaces.CommentCreate = {
        text,
      };
      const comment = await witApi.addComment(commentCreate, project, id);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          id: comment?.id ?? undefined,
          text: comment?.text ?? undefined,
          createdDate: comment?.createdDate ?? undefined,
          url: comment?.url ?? undefined,
        }),
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
