import type { IWorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi";
import type * as WorkItemTrackingInterfaces from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";
import {
  WorkItemExpand,
  CommentSortOrder,
  WorkItemTypeFieldsExpandLevel,
} from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";
import type * as CoreInterfaces from "azure-devops-node-api/interfaces/CoreInterfaces";
import * as VSSInterfaces from "azure-devops-node-api/interfaces/common/VSSInterfaces";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  ensureArray,
  ensureRecord,
  normalizeAzureDevOpsDates,
  createWorkItemOutputSchema,
  getWorkItemCommentsOutputSchema,
  getWorkItemTypeFieldsOutputSchema,
  queryWorkItemsOutputSchema,
  updateWorkItemOutputSchema,
  workItemOutputSchema,
  workItemTypesOutputSchema,
  addWorkItemCommentOutputSchema,
  downloadWorkItemAttachmentOutputSchema,
  addWorkItemAttachmentOutputSchema,
  listQueriesOutputSchema,
  getWorkItemRevisionsOutputSchema,
  deleteWorkItemOutputSchema,
} from "../types/azureDevOps.js";

const workItemIdSchema = z.union([
  z.string().regex(/^\d+$/).transform(Number),
  z.number().int().positive(),
]);

type WorkItemRow = { id?: number; rev?: number; fields?: Record<string, unknown>; url?: string };

function toRowsFormat(
  items: WorkItemRow[],
  requestedFields: string[],
): { fieldNames: string[]; rows: (unknown | null)[][] } {
  let fieldNames: string[];
  if (requestedFields.length > 0) {
    fieldNames = requestedFields;
  } else {
    const keySet = new Set<string>();
    for (const item of items) {
      for (const key of Object.keys(item.fields ?? {})) keySet.add(key);
    }
    fieldNames = Array.from(keySet);
  }
  const rows = items.map((item) =>
    fieldNames.map((fn) => item.fields?.[fn] ?? null),
  );
  return { fieldNames, rows };
}

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
              "可呼叫 get_work_item_type_fields 取得該類型的完整欄位清單。",
          ),
        includeLinks: z
          .boolean()
          .optional()
          .default(false)
          .describe("是否回傳 _links（HATEOAS 導覽連結，共 6 個 href），預設 false"),
        includeRelations: z
          .boolean()
          .optional()
          .default(false)
          .describe("是否回傳 relations（關聯工作項目清單），預設 false"),
      },
      outputSchema: workItemOutputSchema,
    },
    async ({
      id,
      fields,
      includeLinks,
      includeRelations,
    }: {
      id: number;
      fields?: string[];
      includeLinks: boolean;
      includeRelations: boolean;
    }) => {
      const expand =
        includeLinks && includeRelations
          ? WorkItemExpand.All
          : includeLinks
            ? WorkItemExpand.Links
            : includeRelations
              ? WorkItemExpand.Relations
              : WorkItemExpand.None;
      const response = await witApi.getWorkItem(id, fields, undefined, expand);
      const rawFields = response?.fields;
      const responseFields = ensureRecord(rawFields);
      const assignedToRaw = responseFields["System.AssignedTo"];
      const relations = includeRelations
        ? ensureArray<WorkItemTrackingInterfaces.WorkItemRelation>(
            response?.relations,
          )
        : undefined;
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
          _links: includeLinks ? (response?._links ?? undefined) : undefined,
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
          .describe(
            "欄位 referenceName 與對應值的物件，例如 { \"System.Title\": \"Bug 標題\" }。" +
              "可先呼叫 get_work_item_type_fields 取得該類型的完整欄位清單（含必填、允許值）。",
          ),
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
      if (!response?.id) {
        throw new Error(
          `工作項目建立失敗：API 回傳空值。請確認專案名稱、工作項目類型與必填欄位是否正確。`,
        );
      }
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          id: response.id,
          rev: response.rev,
          url: response.url ?? undefined,
          fields: response.fields ?? {},
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
          .describe(
            "要更新的欄位 referenceName 與對應值的物件，例如 { \"System.Title\": \"新標題\" }。" +
              "可先呼叫 get_work_item_type_fields 取得該類型的完整欄位清單（含必填、允許值）。",
          ),
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
        removeRelations: z
          .array(
            z.object({
              url: z.string().describe("目標工作項目的 URL"),
              rel: z
                .string()
                .optional()
                .describe("關聯類型（選填，用於同一目標有多種關聯時精確比對）"),
            }),
          )
          .optional()
          .describe("要移除的關聯清單，依 url（及選填的 rel）比對現有 relations"),
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
      removeRelations,
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
      removeRelations?: Array<{ url: string; rel?: string }>;
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
      if (removeRelations && removeRelations.length > 0) {
        const existing = await witApi.getWorkItem(id, undefined, undefined, WorkItemExpand.Relations);
        const existingRelations = existing?.relations ?? [];
        const indices: number[] = [];
        for (const target of removeRelations) {
          const idx = existingRelations.findIndex(
            (r) =>
              r.url === target.url &&
              (target.rel === undefined || r.rel === target.rel),
          );
          if (idx === -1) {
            throw new Error(
              `找不到符合的 relation：url=${target.url}${target.rel ? `，rel=${target.rel}` : ""}`,
            );
          }
          indices.push(idx);
        }
        // 倒序移除，避免 index 位移
        for (const idx of indices.sort((a, b) => b - a)) {
          operations.push({
            op: VSSInterfaces.Operation.Remove,
            path: `/relations/${idx}`,
          });
        }
      }
      if (operations.length === 0) {
        throw new Error(
          "至少需要提供 state、fields、addRelations 或 removeRelations 其中一個屬性進行更新。",
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
        wiql: z
          .string()
          .min(1)
          .describe(
            "WIQL 查詢字串。範例：" +
              "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' AND [System.TeamProject] = 'MyProject' ORDER BY [System.ChangedDate] DESC；" +
              "若已知 ID 清單可用 IN 語法：SELECT [System.Id] FROM WorkItems WHERE [System.Id] IN (101, 102, 103)",
          ),
        top: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("最多回傳幾筆結果"),
        fetchFields: z
          .array(z.string())
          .optional()
          .describe(
            "若提供此參數，查詢後會自動批次取得工作項目詳細資料並回傳於 workItemDetails。" +
              "傳入空陣列表示取得所有欄位；傳入欄位清單則只取指定欄位以節省 token。" +
              "可呼叫 get_work_item_type_fields 取得該類型的完整欄位清單。",
          ),
        format: z
          .enum(["objects", "rows"])
          .optional()
          .describe(
            "workItemDetails 回傳格式：objects（預設）回傳物件陣列；rows 回傳 fieldNames + rows 二維陣列，" +
              "筆數多（50 筆以上）時可省下大量重複欄位名稱 token。僅在提供 fetchFields 時有效。",
          ),
      },
      outputSchema: queryWorkItemsOutputSchema,
    },
    async ({
      project,
      wiql,
      top,
      fetchFields,
      format,
    }: {
      project?: string;
      wiql: string;
      top?: number;
      fetchFields?: string[];
      format?: "objects" | "rows";
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

      let workItemDetails:
        | WorkItemRow[]
        | { fieldNames: string[]; rows: (unknown | null)[][] }
        | undefined;
      if (fetchFields !== undefined && workItems.length > 0) {
        const ids = workItems
          .map((item) => item.id)
          .filter((id): id is number => id !== undefined);
        const fieldsParam = fetchFields.length > 0 ? fetchFields : undefined;
        const chunkSize = 200;
        const fetched: WorkItemRow[] = [];
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const items = await witApi.getWorkItems(
            chunk,
            fieldsParam,
            undefined,
            undefined,
            undefined,
            project,
          );
          for (const item of ensureArray(items)) {
            const wi = item as WorkItemRow;
            fetched.push({
              id: wi.id ?? undefined,
              rev: wi.rev ?? undefined,
              fields: wi.fields ?? {},
              url: wi.url ?? undefined,
            });
          }
        }
        workItemDetails =
          format === "rows" ? toRowsFormat(fetched, fetchFields) : fetched;
      }

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
          workItemDetails,
        }),
      };
    },
  );
  server.registerTool(
    "list_work_item_types",
    {
      description: "列出專案中可用的工作項目類型。若本次對話中已呼叫過此工具取得相同 project 的結果，請直接使用 context 內的資料，勿重複呼叫。",
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
    "get_work_item_type_fields",
    {
      description:
        "取得指定工作項目類型的所有欄位定義，包含 referenceName、是否必填、允許值與預設值。" +
        "建議在呼叫 create_work_item 或 update_work_item 前先查詢此工具以確認正確的欄位名稱與合法值。" +
        "若本次對話中已呼叫過此工具取得相同 project + type 的結果，請直接使用 context 內的資料，勿重複呼叫。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        type: z.string().min(1).describe("工作項目類型，例如 Bug 或 Task"),
      },
      outputSchema: getWorkItemTypeFieldsOutputSchema,
    },
    async ({ project, type }: { project: string; type: string }) => {
      const fields = await witApi.getWorkItemTypeFieldsWithReferences(
        project,
        type,
        WorkItemTypeFieldsExpandLevel.AllowedValues,
      );
      return {
        content: [],
        structuredContent: {
          fields: ensureArray(fields).map((f: any) => ({
            name: f.name ?? undefined,
            referenceName: f.referenceName ?? undefined,
            alwaysRequired: f.alwaysRequired ?? undefined,
            helpText: f.helpText ?? undefined,
            defaultValue: f.defaultValue ?? undefined,
            allowedValues:
              f.allowedValues && f.allowedValues.length > 0
                ? f.allowedValues
                : undefined,
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_work_item_comments",
    {
      description: "取得工作項目的評論清單",
      inputSchema: {
        id: workItemIdSchema.describe("工作項目編號"),
        project: z.string().min(1).describe("專案名稱或 ID"),
        top: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("最多回傳筆數"),
        order: z
          .enum(["asc", "desc"])
          .optional()
          .describe("排序方向：asc（舊至新）或 desc（新至舊），預設 asc"),
      },
      outputSchema: getWorkItemCommentsOutputSchema,
    },
    async ({
      id,
      project,
      top,
      order,
    }: {
      id: number;
      project: string;
      top?: number;
      order?: "asc" | "desc";
    }) => {
      const orderMap = {
        asc: CommentSortOrder.Asc,
        desc: CommentSortOrder.Desc,
      };
      const result = await witApi.getComments(
        project,
        id,
        top,
        undefined,
        undefined,
        undefined,
        order ? orderMap[order] : undefined,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          totalCount: result?.totalCount ?? undefined,
          count: result?.count ?? undefined,
          continuationToken: result?.continuationToken ?? undefined,
          comments: ensureArray<WorkItemTrackingInterfaces.Comment>(
            result?.comments,
          ).map((c) => ({
            id: c.id ?? undefined,
            text: c.text ?? undefined,
            createdBy: c.createdBy ?? undefined,
            createdDate: c.createdDate ?? undefined,
            modifiedBy: c.modifiedBy ?? undefined,
            modifiedDate: c.modifiedDate ?? undefined,
            isDeleted: c.isDeleted ?? undefined,
            url: c.url ?? undefined,
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

  server.registerTool(
    "add_work_item_tags",
    {
      description:
        "安全地附加 Tag 到工作項目，不覆蓋現有 Tag。" +
        "內部執行：取得現有 Tags → 合併 → 更新。",
      inputSchema: {
        id: workItemIdSchema.describe("工作項目編號"),
        tags: z
          .array(z.string().min(1))
          .min(1)
          .describe("要附加的 Tag 陣列，例如 [\"FrontEnd\", \"模組開發\"]"),
      },
      outputSchema: updateWorkItemOutputSchema,
    },
    async ({ id, tags }: { id: number; tags: string[] }) => {
      const existing = await witApi.getWorkItem(id, ["System.Tags"]);
      const existingTags = parseTagString(
        existing?.fields?.["System.Tags"] as string | undefined,
      );
      const merged = mergeTags(existingTags, tags);
      const operations: VSSInterfaces.JsonPatchOperation[] = [
        {
          op: VSSInterfaces.Operation.Replace,
          path: "/fields/System.Tags",
          value: merged.join("; "),
        },
      ];
      const response = await witApi.updateWorkItem(
        undefined,
        operations,
        id,
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
    "remove_work_item_tags",
    {
      description:
        "從工作項目精確移除指定 Tag，保留其他 Tag。" +
        "內部執行：取得現有 Tags → 移除指定項目 → 更新。",
      inputSchema: {
        id: workItemIdSchema.describe("工作項目編號"),
        tags: z
          .array(z.string().min(1))
          .min(1)
          .describe("要移除的 Tag 陣列"),
      },
      outputSchema: updateWorkItemOutputSchema,
    },
    async ({ id, tags }: { id: number; tags: string[] }) => {
      const existing = await witApi.getWorkItem(id, ["System.Tags"]);
      const existingTags = parseTagString(
        existing?.fields?.["System.Tags"] as string | undefined,
      );
      const removedSet = new Set(tags.map((t) => t.trim().toLowerCase()));
      const remaining = existingTags.filter(
        (t) => !removedSet.has(t.toLowerCase()),
      );
      const operations: VSSInterfaces.JsonPatchOperation[] = [
        {
          op: VSSInterfaces.Operation.Replace,
          path: "/fields/System.Tags",
          value: remaining.join("; "),
        },
      ];
      const response = await witApi.updateWorkItem(
        undefined,
        operations,
        id,
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

  // ── download_work_item_attachment ──────────────────────────────────────────
  server.registerTool(
    "download_work_item_attachment",
    {
      description:
        "下載工作項目附件並儲存至暫存檔，回傳檔案路徑。attachmentId 可從 get_work_item（includeRelations: true）" +
        "回傳的 relations 中，type 為 AttachedFile 的 url 最後一段 GUID 取得。",
      inputSchema: {
        attachmentId: z
          .string()
          .min(1)
          .describe("附件 GUID，自 work item relations 的 AttachedFile url 取得"),
        fileName: z
          .string()
          .optional()
          .describe("檔案名稱（僅用於暫存檔副檔名，選填）"),
        project: z.string().optional().describe("專案名稱或 ID"),
      },
      outputSchema: downloadWorkItemAttachmentOutputSchema,
    },
    async ({
      attachmentId,
      fileName,
      project,
    }: {
      attachmentId: string;
      fileName?: string;
      project?: string;
    }) => {
      const stream = await witApi.getAttachmentContent(
        attachmentId,
        fileName,
        project,
        true,
      );

      const tmpDir = path.join(os.tmpdir(), "ado-mcp");
      fs.mkdirSync(tmpDir, { recursive: true });

      const ext = fileName ? path.extname(fileName) : ".bin";
      const safeName = (fileName ?? attachmentId).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const outPath = path.join(tmpDir, `attachment-${safeName}-${Date.now()}${ext}`);

      const resolvedPath = path.resolve(outPath);
      if (!resolvedPath.startsWith(path.resolve(tmpDir))) {
        throw new Error("無效的輸出路徑");
      }

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
      }
      const buf = Buffer.concat(chunks);
      fs.writeFileSync(resolvedPath, buf);

      return {
        content: [],
        structuredContent: {
          outputFile: { path: resolvedPath, bytes: buf.length },
        },
      };
    },
  );

  // ── add_work_item_attachment ───────────────────────────────────────────────
  server.registerTool(
    "add_work_item_attachment",
    {
      description: "上傳本機檔案為工作項目附件，並建立關聯。",
      inputSchema: {
        workItemId: z.number().int().positive().describe("工作項目編號"),
        filePath: z
          .string()
          .min(1)
          .describe("本機檔案的絕對路徑（檔案必須存在）"),
        project: z.string().optional().describe("專案名稱或 ID"),
        comment: z.string().optional().describe("附件備註（選填）"),
      },
      outputSchema: addWorkItemAttachmentOutputSchema,
    },
    async ({
      workItemId,
      filePath,
      project,
      comment,
    }: {
      workItemId: number;
      filePath: string;
      project?: string;
      comment?: string;
    }) => {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        throw new Error(`找不到檔案或不是一般檔案：${filePath}`);
      }
      const stats = fs.statSync(resolvedPath);
      const MAX_BYTES = 60 * 1024 * 1024;
      if (stats.size > MAX_BYTES) {
        throw new Error(`檔案超過 60 MB 上限（${stats.size} bytes），無法上傳。`);
      }

      const baseName = path.basename(resolvedPath);
      const fileStream = fs.createReadStream(resolvedPath);
      const attachRef = await witApi.createAttachment(
        undefined,
        fileStream,
        baseName,
        undefined,
        project,
      );

      if (!attachRef?.url) {
        throw new Error("附件上傳失敗：API 未回傳 url");
      }

      const operations: VSSInterfaces.JsonPatchOperation[] = [
        {
          op: VSSInterfaces.Operation.Add,
          path: "/relations/-",
          value: {
            rel: "AttachedFile",
            url: attachRef.url,
            attributes: { comment: comment ?? "" },
          },
        },
      ];
      await witApi.updateWorkItem(undefined, operations, workItemId, undefined, undefined, undefined, undefined);

      return {
        content: [],
        structuredContent: {
          workItemId,
          attachmentUrl: attachRef.url,
          fileName: baseName,
        },
      };
    },
  );

  // ── list_queries ───────────────────────────────────────────────────────────
  server.registerTool(
    "list_queries",
    {
      description: "列出專案的共用查詢資料夾與查詢（樹狀結構），可用於取得 queryId 後呼叫 run_query。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        depth: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("遞迴深度，預設 2"),
        folderPath: z
          .string()
          .optional()
          .describe("從指定資料夾路徑開始列出（選填）"),
      },
      outputSchema: listQueriesOutputSchema,
    },
    async ({
      project,
      depth = 2,
      folderPath,
    }: {
      project: string;
      depth?: number;
      folderPath?: string;
    }) => {
      let items: WorkItemTrackingInterfaces.QueryHierarchyItem[];
      if (folderPath) {
        const single = await witApi.getQuery(project, folderPath, undefined, depth);
        items = single ? [single] : [];
      } else {
        items = await witApi.getQueries(project, undefined, depth);
      }

      function mapQueryItem(
        q: WorkItemTrackingInterfaces.QueryHierarchyItem,
      ): Record<string, unknown> {
        return {
          id: q.id ?? undefined,
          name: q.name ?? undefined,
          path: q.path ?? undefined,
          isFolder: q.isFolder ?? undefined,
          hasChildren: q.hasChildren ?? undefined,
          children: q.children
            ? q.children.map(mapQueryItem)
            : undefined,
        };
      }

      return {
        content: [],
        structuredContent: {
          queries: ensureArray<WorkItemTrackingInterfaces.QueryHierarchyItem>(
            items,
          ).map(mapQueryItem),
        },
      };
    },
  );

  // ── run_query ──────────────────────────────────────────────────────────────
  server.registerTool(
    "run_query",
    {
      description:
        "執行團隊已存好的共用查詢（by queryId），結果格式與 query_work_items 完全一致，" +
        "可搭配 fetchFields 批次取得工作項目詳細資料。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        queryId: z
          .string()
          .min(1)
          .describe("查詢 ID（GUID），可由 list_queries 取得"),
        top: z.number().int().positive().optional().describe("最多回傳筆數"),
        fetchFields: z
          .array(z.string())
          .optional()
          .describe(
            "提供時自動批次取得工作項目詳細資料並回傳於 workItemDetails。" +
              "傳入空陣列表示取得所有欄位；傳入欄位清單則只取指定欄位。",
          ),
        format: z
          .enum(["objects", "rows"])
          .optional()
          .describe(
            "workItemDetails 回傳格式：objects（預設）回傳物件陣列；rows 回傳 fieldNames + rows 二維陣列，" +
              "筆數多（50 筆以上）時可省下大量重複欄位名稱 token。僅在提供 fetchFields 時有效。",
          ),
      },
      outputSchema: queryWorkItemsOutputSchema,
    },
    async ({
      project,
      queryId,
      top,
      fetchFields,
      format,
    }: {
      project: string;
      queryId: string;
      top?: number;
      fetchFields?: string[];
      format?: "objects" | "rows";
    }) => {
      const teamContext: CoreInterfaces.TeamContext = { project };
      const wiqlResult = await witApi.queryById(queryId, teamContext, undefined, top);

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

      let workItemDetails:
        | WorkItemRow[]
        | { fieldNames: string[]; rows: (unknown | null)[][] }
        | undefined;

      if (fetchFields !== undefined && workItems.length > 0) {
        const ids = workItems
          .map((item) => item.id)
          .filter((id): id is number => id !== undefined);
        const fieldsParam = fetchFields.length > 0 ? fetchFields : undefined;
        const chunkSize = 200;
        const fetched: WorkItemRow[] = [];
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const items = await witApi.getWorkItems(chunk, fieldsParam, undefined, undefined, undefined, project);
          for (const item of ensureArray(items)) {
            const wi = item as WorkItemRow;
            fetched.push({
              id: wi.id ?? undefined,
              rev: wi.rev ?? undefined,
              fields: wi.fields ?? {},
              url: wi.url ?? undefined,
            });
          }
        }
        workItemDetails =
          format === "rows" ? toRowsFormat(fetched, fetchFields) : fetched;
      }

      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          asOf: wiqlResult.asOf ?? undefined,
          columns: columns.map((column) => ({
            referenceName: column.referenceName ?? undefined,
            name: column.name ?? undefined,
            url: column.url ?? undefined,
          })),
          query: queryId,
          queryResultType: wiqlResult.queryResultType ?? undefined,
          queryType: wiqlResult.queryType ?? undefined,
          workItems: workItems.map((item) => ({
            id: item.id ?? undefined,
            url: item.url ?? undefined,
          })),
          workItemRelations: workItemRelations.map((rel) => ({
            rel: rel.rel ?? undefined,
            source: rel.source ? { id: rel.source.id ?? undefined, url: rel.source.url ?? undefined } : undefined,
            target: rel.target ? { id: rel.target.id ?? undefined, url: rel.target.url ?? undefined } : undefined,
          })),
          workItemDetails,
        }),
      };
    },
  );

  // ── get_work_item_revisions ────────────────────────────────────────────────
  server.registerTool(
    "get_work_item_revisions",
    {
      description:
        "取得工作項目的欄位變更歷程（誰在什麼時候改了哪些欄位）。" +
        "提供 fields 時只回傳包含指定欄位變化的 revision，可大幅減少雜訊。",
      inputSchema: {
        id: z.number().int().positive().describe("工作項目編號"),
        project: z.string().optional().describe("專案名稱或 ID"),
        top: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("最多回傳幾筆更新記錄，預設 10"),
        skip: z.number().int().min(0).optional().describe("跳過筆數（分頁用）"),
        fields: z
          .array(z.string())
          .optional()
          .describe(
            "只追蹤這些欄位的變化（referenceName），提供時過濾掉沒有指定欄位變化的 revision",
          ),
      },
      outputSchema: getWorkItemRevisionsOutputSchema,
    },
    async ({
      id,
      project,
      top = 10,
      skip,
      fields,
    }: {
      id: number;
      project?: string;
      top?: number;
      skip?: number;
      fields?: string[];
    }) => {
      const updates = await witApi.getUpdates(id, top, skip, project);
      const updateList =
        ensureArray<WorkItemTrackingInterfaces.WorkItemUpdate>(updates);

      const fieldSet = fields && fields.length > 0 ? new Set(fields) : undefined;

      const revisions = updateList
        .map((u) => {
          const changedFields: Record<
            string,
            { oldValue: unknown; newValue: unknown }
          > = {};

          if (u.fields) {
            for (const [key, update] of Object.entries(u.fields)) {
              if (fieldSet && !fieldSet.has(key)) continue;
              const fu = update as WorkItemTrackingInterfaces.WorkItemFieldUpdate;
              const oldVal = fu.oldValue;
              const newVal = fu.newValue;
              changedFields[key] = {
                oldValue:
                  typeof oldVal === "string" && oldVal.length > 200
                    ? oldVal.slice(0, 200) + "…"
                    : oldVal,
                newValue:
                  typeof newVal === "string" && newVal.length > 200
                    ? newVal.slice(0, 200) + "…"
                    : newVal,
              };
            }
          }

          if (fieldSet && Object.keys(changedFields).length === 0) return null;

          return {
            rev: u.rev ?? undefined,
            revisedBy: u.revisedBy
              ? {
                  displayName:
                    (u.revisedBy as unknown as { displayName?: string }).displayName ?? undefined,
                  uniqueName:
                    (u.revisedBy as unknown as { uniqueName?: string }).uniqueName ?? undefined,
                }
              : undefined,
            revisedDate: u.revisedDate ?? undefined,
            changedFields:
              Object.keys(changedFields).length > 0 ? changedFields : undefined,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({ revisions }),
      };
    },
  );

  // ── delete_work_item ───────────────────────────────────────────────────────
  server.registerTool(
    "delete_work_item",
    {
      description:
        "將工作項目軟刪除（移至資源回收筒），可由 ADO 入口網站還原。不提供永久刪除（destroy）功能。",
      inputSchema: {
        id: z.number().int().positive().describe("工作項目編號"),
        project: z.string().optional().describe("專案名稱或 ID"),
      },
      outputSchema: deleteWorkItemOutputSchema,
    },
    async ({ id, project }: { id: number; project?: string }) => {
      const result = await witApi.deleteWorkItem(id, project);
      return {
        content: [],
        structuredContent: {
          id: result?.id ?? id,
          deletedDate: result?.deletedDate ?? undefined,
          message: "已移至資源回收筒，可由入口網站還原",
        },
      };
    },
  );
}

function parseTagString(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
}

function mergeTags(existing: string[], toAdd: string[]): string[] {
  const lowerSet = new Set(existing.map((t) => t.toLowerCase()));
  const result = [...existing];
  for (const tag of toAdd) {
    if (!lowerSet.has(tag.trim().toLowerCase())) {
      result.push(tag.trim());
      lowerSet.add(tag.trim().toLowerCase());
    }
  }
  return result;
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
