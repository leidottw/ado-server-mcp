import type { IBuildApi } from "azure-devops-node-api/BuildApi";
import type { IGitApi } from "azure-devops-node-api/GitApi";
import * as BuildInterfaces from "azure-devops-node-api/interfaces/BuildInterfaces";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  ensureArray,
  normalizeAzureDevOpsDates,
  getBuildLogsOutputSchema,
  getBuildTimelineOutputSchema,
  cancelBuildOutputSchema,
  getPipelineDefinitionOutputSchema,
  getPipelineDefinitionYamlOutputSchema,
  listPipelinesOutputSchema,
  getPipelineRunOutputSchema,
  listPipelineRunsOutputSchema,
  queuePipelineOutputSchema,
} from "../types/azureDevOps.js";
import { deliver } from "../fileHandoff.js";

export function registerPipelineTools(
  server: McpServer,
  buildApi: IBuildApi,
  gitApi: IGitApi,
): void {
  server.registerTool(
    "list_pipelines",
    {
      description: "列出專案中的 CI/CD Pipeline 定義（Build Definitions）。若本次對話中已呼叫過此工具取得相同 project 的結果，請直接使用 context 內的資料，勿重複呼叫。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        name: z
          .string()
          .optional()
          .describe("以名稱篩選，支援萬用字元（例如 *deploy*）"),
        top: z.number().int().positive().optional().describe("最多回傳筆數"),
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
        definitionId: z.number().int().positive().describe("Pipeline 定義 ID"),
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
        detail: z
          .enum(["minimal", "full"])
          .optional()
          .describe(
            "minimal（預設）只回傳 id、buildNumber、status、result、startTime、finishTime、sourceBranch、definition（id/name）；" +
              "full 另回傳 requestedBy、requestedFor、parameters、reason、url 等完整欄位",
          ),
      },
      outputSchema: listPipelineRunsOutputSchema,
    },
    async ({
      project,
      definitionId,
      top,
      branchName,
      statusFilter,
      detail = "minimal",
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
      detail?: "minimal" | "full";
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
          runs: ensureArray<BuildInterfaces.Build>(builds).map((b) => {
            if (detail === "full") return mapBuild(b);
            return {
              id: b.id ?? undefined,
              buildNumber: b.buildNumber ?? undefined,
              status: b.status ?? undefined,
              result: b.result ?? undefined,
              startTime: b.startTime ?? undefined,
              finishTime: b.finishTime ?? undefined,
              sourceBranch: b.sourceBranch ?? undefined,
              definition: b.definition
                ? {
                    id: b.definition.id ?? undefined,
                    name: b.definition.name ?? undefined,
                  }
                : undefined,
            };
          }),
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
        definitionId: z.number().int().positive().describe("Pipeline 定義 ID"),
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
    "get_pipeline_definition",
    {
      description:
        "取得單一 Pipeline 定義的詳細資訊，包含 repository、變數與觸發設定。若本次對話中已呼叫過此工具取得相同 project + definitionId 的結果，請直接使用 context 內的資料，勿重複呼叫。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        definitionId: z.number().int().positive().describe("Pipeline 定義 ID"),
      },
      outputSchema: getPipelineDefinitionOutputSchema,
    },
    async ({
      project,
      definitionId,
    }: {
      project: string;
      definitionId: number;
    }) => {
      const def = await buildApi.getDefinition(project, definitionId);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          id: def?.id ?? undefined,
          name: def?.name ?? undefined,
          path: def?.path ?? undefined,
          url: def?.url ?? undefined,
          revision: def?.revision ?? undefined,
          createdDate: def?.createdDate ?? undefined,
          description: def?.description ?? undefined,
          buildNumberFormat: def?.buildNumberFormat ?? undefined,
          jobTimeoutInMinutes: def?.jobTimeoutInMinutes ?? undefined,
          tags: def?.tags ?? undefined,
          repository: def?.repository
            ? {
                id: def.repository.id ?? undefined,
                name: def.repository.name ?? undefined,
                type: def.repository.type ?? undefined,
                defaultBranch: def.repository.defaultBranch ?? undefined,
                url: def.repository.url ?? undefined,
                rootFolder: def.repository.rootFolder ?? undefined,
                clean: def.repository.clean ?? undefined,
                checkoutSubmodules:
                  def.repository.checkoutSubmodules ?? undefined,
              }
            : undefined,
          variables: def?.variables ?? undefined,
          authoredBy: def?.authoredBy ?? undefined,
        }),
      };
    },
  );

  server.registerTool(
    "get_pipeline_definition_yaml",
    {
      description: "取得 Pipeline 定義的完整 YAML 內容。若本次對話中已呼叫過此工具取得相同 project + definitionId 的結果，請直接使用 context 內的資料，勿重複呼叫。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        definitionId: z.number().int().positive().describe("Pipeline 定義 ID"),
        output: z
          .enum(["inline", "file", "auto"])
          .optional()
          .describe(
            "回傳方式：inline 直接回傳內容；file 寫入暫存檔回傳路徑；auto（預設）依大小自動判斷。YAML 較大時建議 file。",
          ),
      },
      outputSchema: getPipelineDefinitionYamlOutputSchema,
    },
    async ({
      project,
      definitionId,
      output = "auto",
    }: {
      project: string;
      definitionId: number;
      output?: "inline" | "file" | "auto";
    }) => {
      const def = await buildApi.getDefinition(project, definitionId);
      const yamlFilename = (
        def?.process as BuildInterfaces.YamlProcess | undefined
      )?.yamlFilename;
      const repositoryId = def?.repository?.id;
      if (!yamlFilename || !repositoryId) {
        return { content: [], structuredContent: { yaml: undefined } };
      }
      const item = await gitApi.getItem(
        repositoryId,
        yamlFilename,
        project,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      );
      const yaml = item?.content ?? "";
      const result = await deliver(yaml, {
        output,
        toolName: "get_pipeline_definition_yaml",
        key: `def${definitionId}`,
        ext: "yaml",
      });
      if ("savedToFile" in result) {
        const { savedToFile: _, ...outputFile } = result;
        return { content: [], structuredContent: { outputFile } };
      }
      return { content: [], structuredContent: { yaml: result.text || undefined } };
    },
  );

  server.registerTool(
    "get_build_logs",
    {
      description:
        "取得 Build 的 log 清單或特定 log 的內容，可用於檢視 PR 觸發的 CI 建置結果。" +
        "省略 logId 時回傳所有 log 的清單（含行數），提供 logId 時回傳該 log 的文字內容。" +
        "提供 logId 時可用 grep 參數以正規表示式過濾關鍵字，大幅節省 token；grep 與 startLine/endLine 互斥，同時提供時 grep 優先。" +
        "建議搭配 get_build_timeline 使用：先取得失敗 task 的 logId 與 errorIssues，再用 grep 快速定位完整錯誤上下文。",
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
          .describe("起始行號（1-based），僅在提供 logId 時有效；提供 grep 時忽略"),
        endLine: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("結束行號（1-based），僅在提供 logId 時有效；提供 grep 時忽略"),
        grep: z
          .string()
          .optional()
          .describe(
            "正規表示式（不分大小寫）。提供時只回傳符合的行及其上下文，大幅節省 token。" +
              "例：'error|failed|exception'，或從 get_build_timeline errorIssues 取得的關鍵字",
          ),
        grepContext: z
          .number()
          .int()
          .min(0)
          .max(20)
          .optional()
          .describe("每個符合行前後各附帶幾行上下文，預設 2"),
        maxMatches: z
          .number()
          .int()
          .positive()
          .max(200)
          .optional()
          .describe("最多回傳幾個符合段落，預設 50"),
        output: z
          .enum(["inline", "file", "auto"])
          .optional()
          .describe(
            "回傳方式：inline 直接回傳內容；file 寫入暫存檔回傳路徑；auto（預設）依大小自動判斷。" +
              "僅在提供 logId 且無 grep 時有效（grep 結果一律 inline）。",
          ),
      },
      outputSchema: getBuildLogsOutputSchema,
    },
    async ({
      project,
      buildId,
      logId,
      startLine,
      endLine,
      grep,
      grepContext,
      maxMatches,
      output = "auto",
    }: {
      project: string;
      buildId: number;
      logId?: number;
      startLine?: number;
      endLine?: number;
      grep?: string;
      grepContext?: number;
      maxMatches?: number;
      output?: "inline" | "file" | "auto";
    }) => {
      if (logId !== undefined) {
        if (grep !== undefined) {
          let regex: RegExp;
          try {
            regex = new RegExp(grep, "i");
          } catch (e) {
            return {
              content: [],
              structuredContent: {
                error: `grep 參數無效的正規表示式：${(e as Error).message}`,
              },
            };
          }

          const allLines = ensureArray<string>(
            await buildApi.getBuildLogLines(project, buildId, logId),
          );
          const ctx = grepContext ?? 2;
          const maxM = maxMatches ?? 50;
          const matchItems: Array<{
            line: number;
            text: string;
            context: string[];
          }> = [];
          let totalMatches = 0;

          for (let i = 0; i < allLines.length; i++) {
            const line = allLines[i] ?? "";
            if (regex.test(line)) {
              totalMatches++;
              if (matchItems.length < maxM) {
                const contextLines: string[] = [];
                const ctxStart = Math.max(0, i - ctx);
                const ctxEnd = Math.min(allLines.length - 1, i + ctx);
                for (let j = ctxStart; j <= ctxEnd; j++) {
                  const ctxLine = allLines[j];
                  if (j !== i && ctxLine !== undefined) contextLines.push(ctxLine);
                }
                matchItems.push({ line: i + 1, text: line, context: contextLines });
              }
            }
          }

          return {
            content: [],
            structuredContent: { matches: matchItems, totalMatches },
          };
        }

        const lines = ensureArray<string>(
          await buildApi.getBuildLogLines(project, buildId, logId, startLine, endLine),
        );
        const logText = lines.join("\n");
        const handoff = await deliver(logText, {
          output,
          toolName: "get_build_logs",
          key: `build${buildId}-log${logId}`,
          ext: "log",
        });
        if ("savedToFile" in handoff) {
          const { savedToFile: _, ...outputFile } = handoff;
          return { content: [], structuredContent: { outputFile } };
        }
        return { content: [], structuredContent: { lines } };
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
  server.registerTool(
    "get_build_timeline",
    {
      description:
        "取得 Build 的結構化執行時間軸（stage/job/task 的成敗與時間），用於快速定位 CI 失敗點，" +
        "比逐一閱讀 log 節省大量 token。找到失敗 task 後，以其 logId 呼叫 get_build_logs 並善用 grep 參數。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        buildId: z.number().int().positive().describe("Build（執行）ID"),
        failedOnly: z
          .boolean()
          .optional()
          .describe(
            "只回傳 result 為 failed/canceled 的節點及其祖先鏈，預設 true。設為 false 回傳完整記錄。",
          ),
      },
      outputSchema: getBuildTimelineOutputSchema,
    },
    async ({
      project,
      buildId,
      failedOnly = true,
    }: {
      project: string;
      buildId: number;
      failedOnly?: boolean;
    }) => {
      const timeline = await buildApi.getBuildTimeline(project, buildId);
      const allRecords = ensureArray<BuildInterfaces.TimelineRecord>(
        timeline?.records,
      );

      const mapped = allRecords.map((r) => ({
        id: r.id ?? undefined,
        parentId: r.parentId ?? undefined,
        type: r.type ?? undefined,
        name: r.name ?? undefined,
        state: r.state ?? undefined,
        result: r.result ?? undefined,
        startTime: r.startTime ?? undefined,
        finishTime: r.finishTime ?? undefined,
        logId: r.log?.id ?? undefined,
        errorIssues: ensureArray<BuildInterfaces.Issue>(r.issues)
          .filter((i) => i.type === BuildInterfaces.IssueType.Error)
          .map((i) => {
            const msg = i.message ?? "";
            return msg.length > 500 ? msg.slice(0, 500) + "…" : msg;
          }),
      }));

      let records = mapped;
      if (failedOnly) {
        // TaskResult: 0=Succeeded, 1=SucceededWithIssues, 2=Failed, 3=Canceled, 4=Skipped, 5=Abandoned
        const failedIds = new Set(
          mapped
            .filter(
              (r) =>
                r.result === BuildInterfaces.TaskResult.Failed ||
                r.result === BuildInterfaces.TaskResult.Canceled ||
                r.result === BuildInterfaces.TaskResult.Abandoned,
            )
            .map((r) => r.id),
        );

        if (failedIds.size > 0) {
          // 收集祖先鏈
          const idToRecord = new Map(mapped.map((r) => [r.id, r]));
          const includedIds = new Set<string | undefined>(failedIds);
          for (const id of failedIds) {
            let current = idToRecord.get(id);
            while (current?.parentId) {
              includedIds.add(current.parentId);
              current = idToRecord.get(current.parentId);
            }
          }
          records = mapped.filter((r) => includedIds.has(r.id));
        }
      }

      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          records,
          totalRecords: allRecords.length,
        }),
      };
    },
  );

  server.registerTool(
    "cancel_build",
    {
      description: "取消正在執行的 Build（Pipeline Run）。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        buildId: z.number().int().positive().describe("Build（執行）ID"),
      },
      outputSchema: cancelBuildOutputSchema,
    },
    async ({ project, buildId }: { project: string; buildId: number }) => {
      const updated = await buildApi.updateBuild(
        { status: BuildInterfaces.BuildStatus.Cancelling },
        project,
        buildId,
      );
      return {
        content: [],
        structuredContent: {
          id: updated?.id ?? undefined,
          status: updated?.status ?? undefined,
        },
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
