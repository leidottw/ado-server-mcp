import type { IBuildApi } from "azure-devops-node-api/BuildApi";
import * as BuildInterfaces from "azure-devops-node-api/interfaces/BuildInterfaces";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  ensureArray,
  normalizeAzureDevOpsDates,
  getBuildLogsOutputSchema,
  listPipelinesOutputSchema,
  getPipelineRunOutputSchema,
  listPipelineRunsOutputSchema,
  queuePipelineOutputSchema,
} from "../types/azureDevOps.js";

export function registerPipelineTools(
  server: McpServer,
  buildApi: IBuildApi,
): void {
  server.registerTool(
    "list_pipelines",
    {
      description: "列出專案中的 CI/CD Pipeline 定義（Build Definitions）",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        name: z
          .string()
          .optional()
          .describe("以名稱篩選，支援萬用字元（例如 *deploy*）"),
        top: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("最多回傳筆數"),
      },
      outputSchema: listPipelinesOutputSchema,
    },
    async ({
      project,
      name,
      top,
    }: {
      project: string;
      name?: string;
      top?: number;
    }) => {
      const definitions = await buildApi.getDefinitions(
        project,
        name,
        undefined,
        undefined,
        undefined,
        top,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          project,
          pipelines: ensureArray<BuildInterfaces.BuildDefinitionReference>(
            definitions,
          ).map((d) => ({
            id: d.id ?? undefined,
            name: d.name ?? undefined,
            path: d.path ?? undefined,
            url: d.url ?? undefined,
            queueStatus: d.queueStatus ?? undefined,
            type: d.type ?? undefined,
          })),
        }),
      };
    },
  );

  server.registerTool(
    "list_pipeline_runs",
    {
      description: "列出 Pipeline 的執行歷程（Builds）",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        definitionId: z
          .number()
          .int()
          .positive()
          .describe("Pipeline 定義 ID"),
        top: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("最多回傳筆數，預設 10"),
        branchName: z
          .string()
          .optional()
          .describe("篩選特定分支，例如 refs/heads/main"),
        statusFilter: z
          .enum([
            "all",
            "inProgress",
            "completed",
            "cancelling",
            "postponed",
            "notStarted",
          ])
          .optional()
          .describe("執行狀態篩選，預設為 all"),
      },
      outputSchema: listPipelineRunsOutputSchema,
    },
    async ({
      project,
      definitionId,
      top,
      branchName,
      statusFilter,
    }: {
      project: string;
      definitionId: number;
      top?: number;
      branchName?: string;
      statusFilter?:
        | "all"
        | "inProgress"
        | "completed"
        | "cancelling"
        | "postponed"
        | "notStarted";
    }) => {
      const statusMap: Record<string, BuildInterfaces.BuildStatus> = {
        all: BuildInterfaces.BuildStatus.All,
        inProgress: BuildInterfaces.BuildStatus.InProgress,
        completed: BuildInterfaces.BuildStatus.Completed,
        cancelling: BuildInterfaces.BuildStatus.Cancelling,
        postponed: BuildInterfaces.BuildStatus.Postponed,
        notStarted: BuildInterfaces.BuildStatus.NotStarted,
      };
      const statusValue = statusFilter
        ? statusMap[statusFilter]
        : BuildInterfaces.BuildStatus.All;
      const builds = await buildApi.getBuilds(
        project,
        [definitionId],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        statusValue,
        undefined,
        undefined,
        undefined,
        top ?? 10,
        undefined,
        undefined,
        undefined,
        undefined,
        branchName,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          runs: ensureArray<BuildInterfaces.Build>(builds).map(mapBuild),
        }),
      };
    },
  );

  server.registerTool(
    "get_pipeline_run",
    {
      description: "取得單一 Pipeline 執行（Build）的詳細資訊與結果",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        runId: z.number().int().positive().describe("Build（執行）ID"),
      },
      outputSchema: getPipelineRunOutputSchema,
    },
    async ({ project, runId }: { project: string; runId: number }) => {
      const build = await buildApi.getBuild(project, runId);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(mapBuild(build)),
      };
    },
  );

  server.registerTool(
    "queue_pipeline",
    {
      description: "觸發 Pipeline 執行（Queue a Build）",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        definitionId: z
          .number()
          .int()
          .positive()
          .describe("Pipeline 定義 ID"),
        sourceBranch: z
          .string()
          .optional()
          .describe("要執行的分支，例如 refs/heads/main"),
        parameters: z
          .record(z.string(), z.string())
          .optional()
          .describe("Pipeline 參數（key-value 對）"),
      },
      outputSchema: queuePipelineOutputSchema,
    },
    async ({
      project,
      definitionId,
      sourceBranch,
      parameters,
    }: {
      project: string;
      definitionId: number;
      sourceBranch?: string;
      parameters?: Record<string, string>;
    }) => {
      const build: BuildInterfaces.Build = {
        definition: { id: definitionId },
        sourceBranch,
        parameters: parameters ? JSON.stringify(parameters) : undefined,
      };
      const queued = await buildApi.queueBuild(build, project);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(mapBuild(queued)),
      };
    },
  );

  server.registerTool(
    "get_build_logs",
    {
      description:
        "取得 Build 的 log 清單或特定 log 的內容，可用於檢視 PR 觸發的 CI 建置結果。省略 logId 時回傳所有 log 的清單（含行數），提供 logId 時回傳該 log 的文字內容。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        buildId: z.number().int().positive().describe("Build（執行）ID"),
        logId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Log ID；省略時回傳 log 清單，提供時回傳 log 文字內容"),
        startLine: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("起始行號（1-based），僅在提供 logId 時有效"),
        endLine: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("結束行號（1-based），僅在提供 logId 時有效"),
      },
      outputSchema: getBuildLogsOutputSchema,
    },
    async ({
      project,
      buildId,
      logId,
      startLine,
      endLine,
    }: {
      project: string;
      buildId: number;
      logId?: number;
      startLine?: number;
      endLine?: number;
    }) => {
      if (logId !== undefined) {
        const lines = await buildApi.getBuildLogLines(
          project,
          buildId,
          logId,
          startLine,
          endLine,
        );
        return {
          content: [],
          structuredContent: { lines: ensureArray<string>(lines) },
        };
      }
      const logs = await buildApi.getBuildLogs(project, buildId);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          logs: ensureArray<BuildInterfaces.BuildLog>(logs).map((l) => ({
            id: l.id ?? undefined,
            type: l.type ?? undefined,
            url: l.url ?? undefined,
            lineCount: l.lineCount ?? undefined,
            createdOn: l.createdOn ?? undefined,
            lastChangedOn: l.lastChangedOn ?? undefined,
          })),
        }),
      };
    },
  );
}

function mapBuild(
  b: BuildInterfaces.Build | undefined,
): Record<string, unknown> {
  return {
    id: b?.id ?? undefined,
    buildNumber: b?.buildNumber ?? undefined,
    status: b?.status ?? undefined,
    result: b?.result ?? undefined,
    queueTime: b?.queueTime ?? undefined,
    startTime: b?.startTime ?? undefined,
    finishTime: b?.finishTime ?? undefined,
    url: b?.url ?? undefined,
    sourceBranch: b?.sourceBranch ?? undefined,
    sourceVersion: b?.sourceVersion ?? undefined,
    parameters: b?.parameters ?? undefined,
    reason: b?.reason ?? undefined,
    requestedBy: b?.requestedBy ?? undefined,
    requestedFor: b?.requestedFor ?? undefined,
    definition: b?.definition
      ? {
          id: b.definition.id ?? undefined,
          name: b.definition.name ?? undefined,
          path: (b.definition as { path?: string }).path ?? undefined,
          url: b.definition.url ?? undefined,
        }
      : undefined,
    project: b?.project
      ? {
          id: b.project.id ?? undefined,
          name: b.project.name ?? undefined,
        }
      : undefined,
  };
}
