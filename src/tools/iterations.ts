import type { IWorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi";
import type { IWorkApi } from "azure-devops-node-api/WorkApi";
import { TreeStructureGroup } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  ensureArray,
  normalizeAzureDevOpsDates,
  classificationNodeOutputSchema,
  listIterationsOutputSchema,
  teamIterationOutputSchema,
  listTeamIterationsOutputSchema,
} from "../types/azureDevOps.js";

export function registerIterationTools(
  server: McpServer,
  witApi: IWorkItemTrackingApi,
  workApi: IWorkApi,
): void {
  server.registerTool(
    "create_iteration",
    {
      description:
        "在指定父路徑下建立新的 Iteration 節點，支援設定起訖日期。" +
        "父節點路徑留空表示建立在專案根層。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        parentPath: z
          .string()
          .optional()
          .describe(
            "父節點路徑，相對於專案根節點，例如 '儀校系統'。留空表示建立在根層。",
          ),
        name: z.string().min(1).describe("新節點名稱，例如 'Phase 1'"),
        startDate: z
          .string()
          .optional()
          .describe("開始日期，ISO 8601 格式，例如 '2026-06-04'"),
        finishDate: z
          .string()
          .optional()
          .describe("結束日期，ISO 8601 格式，例如 '2026-06-30'"),
      },
      outputSchema: classificationNodeOutputSchema,
    },
    async ({
      project,
      parentPath,
      name,
      startDate,
      finishDate,
    }: {
      project: string;
      parentPath?: string;
      name: string;
      startDate?: string;
      finishDate?: string;
    }) => {
      const attributes: Record<string, string> = {};
      if (startDate) {
        attributes["startDate"] = startDate.includes("T")
          ? startDate
          : `${startDate}T00:00:00Z`;
      }
      if (finishDate) {
        attributes["finishDate"] = finishDate.includes("T")
          ? finishDate
          : `${finishDate}T00:00:00Z`;
      }
      const node = {
        name,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      };
      const result = await witApi.createOrUpdateClassificationNode(
        node,
        project,
        TreeStructureGroup.Iterations,
        parentPath,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          id: result?.id ?? undefined,
          identifier: result?.identifier ?? undefined,
          name: result?.name ?? undefined,
          structureType: result?.structureType ?? undefined,
          hasChildren: result?.hasChildren ?? undefined,
          path: result?.path ?? undefined,
          attributes: result?.attributes ?? undefined,
          url: result?.url ?? undefined,
        }),
      };
    },
  );

  server.registerTool(
    "update_iteration",
    {
      description: "更新既有 Iteration 節點的名稱或起訖日期。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        path: z
          .string()
          .min(1)
          .describe(
            "目標節點相對路徑（相對於專案根節點），例如 '儀校系統\\Phase 1'",
          ),
        name: z.string().optional().describe("新節點名稱（重新命名時使用）"),
        startDate: z
          .string()
          .optional()
          .describe("更新開始日期，ISO 8601 格式"),
        finishDate: z
          .string()
          .optional()
          .describe("更新結束日期，ISO 8601 格式"),
      },
      outputSchema: classificationNodeOutputSchema,
    },
    async ({
      project,
      path,
      name,
      startDate,
      finishDate,
    }: {
      project: string;
      path: string;
      name?: string;
      startDate?: string;
      finishDate?: string;
    }) => {
      const attributes: Record<string, string> = {};
      if (startDate) {
        attributes["startDate"] = startDate.includes("T")
          ? startDate
          : `${startDate}T00:00:00Z`;
      }
      if (finishDate) {
        attributes["finishDate"] = finishDate.includes("T")
          ? finishDate
          : `${finishDate}T00:00:00Z`;
      }
      const node: Record<string, unknown> = {};
      if (name) node["name"] = name;
      if (Object.keys(attributes).length > 0) node["attributes"] = attributes;

      const result = await witApi.updateClassificationNode(
        node as any,
        project,
        TreeStructureGroup.Iterations,
        path,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          id: result?.id ?? undefined,
          identifier: result?.identifier ?? undefined,
          name: result?.name ?? undefined,
          structureType: result?.structureType ?? undefined,
          hasChildren: result?.hasChildren ?? undefined,
          path: result?.path ?? undefined,
          attributes: result?.attributes ?? undefined,
          url: result?.url ?? undefined,
        }),
      };
    },
  );

  server.registerTool(
    "list_iterations",
    {
      description:
        "查詢專案下的 Iteration 或 Area 樹狀結構，可指定展開層數。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        type: z
          .enum(["iterations", "areas"])
          .default("iterations")
          .describe("節點類型：iterations（反覆項目）或 areas（區域），預設 iterations"),
        path: z
          .string()
          .optional()
          .describe(
            "查詢起始路徑（相對於專案根節點），留空則從根節點開始",
          ),
        depth: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .default(2)
          .describe("樹狀展開層數，預設 2，最大 10"),
      },
      outputSchema: listIterationsOutputSchema,
    },
    async ({
      project,
      type,
      path,
      depth,
    }: {
      project: string;
      type: "iterations" | "areas";
      path?: string;
      depth: number;
    }) => {
      const structureGroup =
        type === "areas"
          ? TreeStructureGroup.Areas
          : TreeStructureGroup.Iterations;
      const result = await witApi.getClassificationNode(
        project,
        structureGroup,
        path,
        depth,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(
          mapClassificationNode(result),
        ),
      };
    },
  );

  server.registerTool(
    "assign_team_iteration",
    {
      description:
        "將已建立的 Iteration 節點指派給指定 Team，使其出現在 Team Board 與 Sprint 清單中。" +
        "iterationId 可從 create_iteration 或 list_iterations 回傳的 identifier 欄位取得。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        team: z.string().min(1).describe("Team 名稱或 ID，例如 'MESI-Team'"),
        iterationId: z
          .string()
          .min(1)
          .describe("Iteration 節點的 GUID（identifier 欄位）"),
      },
      outputSchema: teamIterationOutputSchema,
    },
    async ({
      project,
      team,
      iterationId,
    }: {
      project: string;
      team: string;
      iterationId: string;
    }) => {
      const teamContext = { project, team };
      const result = await workApi.postTeamIteration(
        { id: iterationId } as any,
        teamContext,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          id: result?.id ?? undefined,
          name: result?.name ?? undefined,
          path: result?.path ?? undefined,
          attributes: result?.attributes ?? undefined,
          url: result?.url ?? undefined,
        }),
      };
    },
  );

  server.registerTool(
    "list_team_iterations",
    {
      description: "查詢 Team 目前已指派的 Iteration 清單，含 ID、名稱、日期與時間框架。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        team: z.string().min(1).describe("Team 名稱或 ID"),
        timeframe: z
          .enum(["past", "current", "future"])
          .optional()
          .describe("時間框架篩選：past、current 或 future，不傳則回傳全部"),
      },
      outputSchema: listTeamIterationsOutputSchema,
    },
    async ({
      project,
      team,
      timeframe,
    }: {
      project: string;
      team: string;
      timeframe?: "past" | "current" | "future";
    }) => {
      const teamContext = { project, team };
      const results = await workApi.getTeamIterations(teamContext, timeframe);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          iterations: ensureArray(results).map((iter: any) => ({
            id: iter?.id ?? undefined,
            name: iter?.name ?? undefined,
            path: iter?.path ?? undefined,
            attributes: iter?.attributes ?? undefined,
            url: iter?.url ?? undefined,
          })),
        }),
      };
    },
  );
}

function mapClassificationNode(node: any): Record<string, unknown> {
  if (!node) return {};
  return {
    id: node.id ?? undefined,
    identifier: node.identifier ?? undefined,
    name: node.name ?? undefined,
    structureType: node.structureType ?? undefined,
    hasChildren: node.hasChildren ?? undefined,
    path: node.path ?? undefined,
    attributes: node.attributes ?? undefined,
    children: node.children
      ? ensureArray(node.children).map(mapClassificationNode)
      : undefined,
    url: node.url ?? undefined,
  };
}
