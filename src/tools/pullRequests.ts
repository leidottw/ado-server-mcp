import { readInputFile } from "../fileHandoff.js";
import type { IGitApi } from "azure-devops-node-api/GitApi";
import type { IWorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi";
import * as GitInterfaces from "azure-devops-node-api/interfaces/GitInterfaces";
import * as VSSInterfaces from "azure-devops-node-api/interfaces/common/VSSInterfaces";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  ensureArray,
  normalizeAzureDevOpsDates,
  createPullRequestThreadOutputSchema,
  createPullRequestThreadCommentOutputSchema,
  createPullRequestOutputSchema,
  getPullRequestChangesOutputSchema,
  getPullRequestThreadsOutputSchema,
  getPullRequestStatusesOutputSchema,
  getPullRequestWorkItemsOutputSchema,
  pullRequestDetailOutputSchema,
  pullRequestSummaryOutputSchema,
  pullRequestThreadOutputSchema,
  repositoryOutputSchema,
  updatePrReviewerOutputSchema,
  updatePrThreadOutputSchema,
  updatePullRequestOutputSchema,
} from "../types/azureDevOps.js";

function parseGitPullRequestStatus(
  status?: "active" | "abandoned" | "completed" | "all",
): GitInterfaces.PullRequestStatus | undefined {
  switch (status) {
    case "active":
      return GitInterfaces.PullRequestStatus.Active;
    case "abandoned":
      return GitInterfaces.PullRequestStatus.Abandoned;
    case "completed":
      return GitInterfaces.PullRequestStatus.Completed;
    case "all":
      return GitInterfaces.PullRequestStatus.All;
    default:
      return undefined;
  }
}

export function registerPullRequestTools(
  server: McpServer,
  gitApi: IGitApi,
  witApi?: IWorkItemTrackingApi,
): void {
  server.registerTool(
    "get_repositories",
    {
      description: "列出指定專案內的 Git 儲存庫。若本次對話中已呼叫過此工具取得相同 project 的結果，請直接使用 context 內的資料，勿重複呼叫。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
      },
      outputSchema: z.object({
        project: z.string(),
        repositories: z.array(repositoryOutputSchema),
      }),
    },
    async ({ project }: { project: string }) => {
      const repositories = await gitApi.getRepositories(project);
      return {
        content: [],
        structuredContent: {
          project,
          repositories: ensureArray<GitInterfaces.GitRepository>(
            repositories,
          ).map((repo) => ({
            id: repo.id ?? undefined,
            name: repo.name ?? undefined,
            url: repo.webUrl ?? repo.remoteUrl ?? undefined,
            defaultBranch: repo.defaultBranch ?? undefined,
            remoteUrl: repo.remoteUrl ?? undefined,
            sshUrl: repo.sshUrl ?? undefined,
            projectId: repo.project?.id ?? undefined,
            projectName: repo.project?.name ?? undefined,
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_pull_requests",
    {
      description: "取得指定專案下的 Git 拉取請求",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        status: z
          .enum(["active", "abandoned", "completed", "all"])
          .optional()
          .describe("狀態篩選，預設為 active"),
        repositoryId: z
          .string()
          .optional()
          .describe("限定特定儲存庫 ID 或名稱"),
        creatorId: z.string().optional().describe("建立者的身份 ID"),
        reviewerId: z.string().optional().describe("審查者的身份 ID"),
        sourceRefName: z
          .string()
          .optional()
          .describe("來源分支，例如 refs/heads/feature"),
        targetRefName: z
          .string()
          .optional()
          .describe("目標分支，例如 refs/heads/main"),
        top: z.number().int().positive().optional().describe("最多回傳筆數"),
        skip: z.number().int().min(0).optional().describe("跳過筆數（分頁用）"),
        detail: z
          .enum(["minimal", "full"])
          .optional()
          .describe(
            "minimal（預設）只回傳識別與狀態欄位，createdBy 僅保留 displayName；" +
              "full 另回傳 description、isDraft、reviewers、url 等完整欄位",
          ),
      },
      outputSchema: z.object({
        project: z.string(),
        pullRequests: z.array(pullRequestSummaryOutputSchema),
      }),
    },
    async ({
      project,
      status,
      repositoryId,
      creatorId,
      reviewerId,
      sourceRefName,
      targetRefName,
      top,
      skip,
      detail = "minimal",
    }: {
      project: string;
      status?: "active" | "abandoned" | "completed" | "all";
      repositoryId?: string;
      creatorId?: string;
      reviewerId?: string;
      sourceRefName?: string;
      targetRefName?: string;
      top?: number;
      skip?: number;
      detail?: "minimal" | "full";
    }) => {
      const searchCriteria: GitInterfaces.GitPullRequestSearchCriteria = {};
      if (status && status !== "all") {
        searchCriteria.status = parseGitPullRequestStatus(status);
      }
      if (repositoryId) searchCriteria.repositoryId = repositoryId;
      if (creatorId) searchCriteria.creatorId = creatorId;
      if (reviewerId) searchCriteria.reviewerId = reviewerId;
      if (sourceRefName) searchCriteria.sourceRefName = sourceRefName;
      if (targetRefName) searchCriteria.targetRefName = targetRefName;
      const pullRequests = await gitApi.getPullRequestsByProject(
        project,
        searchCriteria,
        undefined,
        skip,
        top,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          project,
          pullRequests: ensureArray<GitInterfaces.GitPullRequest>(
            pullRequests,
          ).map((pr) => {
            const base = {
              pullRequestId: pr.pullRequestId ?? undefined,
              repositoryId: pr.repository?.id ?? undefined,
              title: pr.title ?? undefined,
              status: pr.status ?? undefined,
              sourceRefName: pr.sourceRefName ?? undefined,
              targetRefName: pr.targetRefName ?? undefined,
              creationDate: pr.creationDate ?? undefined,
              mergeStatus: pr.mergeStatus ?? undefined,
              createdBy: pr.createdBy
                ? { displayName: pr.createdBy.displayName ?? undefined }
                : undefined,
            };
            if (detail === "full") {
              return {
                ...base,
                createdBy: pr.createdBy ?? undefined,
                description: pr.description ?? undefined,
                isDraft: pr.isDraft ?? undefined,
                reviewers: ensureArray<GitInterfaces.IdentityRefWithVote>(
                  pr.reviewers,
                ).map((r) => ({
                  displayName: r.displayName ?? undefined,
                  uniqueName: r.uniqueName ?? undefined,
                  vote: r.vote ?? undefined,
                })),
                url: pr.url ?? undefined,
              };
            }
            return base;
          }),
        }),
      };
    },
  );

  server.registerTool(
    "get_pull_request_details",
    {
      description: "取得單一拉取請求詳細資訊與對話串內容",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        pullRequestId: z.number().int().positive().describe("拉取請求編號"),
      },
      outputSchema: z.object({
        pullRequest: pullRequestDetailOutputSchema,
        threads: z.array(pullRequestThreadOutputSchema),
      }),
    },
    async ({
      repositoryId,
      pullRequestId,
    }: {
      repositoryId: string;
      pullRequestId: number;
    }) => {
      const pullRequest = await gitApi.getPullRequest(
        repositoryId,
        pullRequestId,
        undefined,
      );
      const threads = await gitApi.getThreads(
        repositoryId,
        pullRequestId,
        undefined,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          pullRequest: pullRequest as GitInterfaces.GitPullRequest,
          threads:
            ensureArray<GitInterfaces.GitPullRequestCommentThread>(threads),
        }),
      };
    },
  );

  server.registerTool(
    "create_pull_request",
    {
      description: "建立新的拉取請求",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫的 GUID（不支援名稱），可透過 list_repositories 取得"),
        sourceRefName: z
          .string()
          .min(1)
          .describe("來源分支名稱，例如 refs/heads/feature"),
        targetRefName: z
          .string()
          .min(1)
          .describe("目標分支名稱，例如 refs/heads/main"),
        title: z.string().min(1).describe("拉取請求標題"),
        description: z.string().optional().describe("說明內容（內容已存在於本機檔案時請改用 descriptionFile 以節省 output token）"),
        descriptionFile: z.string().optional().describe("【優先使用】本機檔案絕對路徑；說明內容已在本機檔案時必須用此參數取代 description，工具直接讀檔，可大幅節省 output token"),
        isDraft: z.boolean().optional().describe("是否建立為草稿 PR"),
        reviewers: z
          .array(z.string())
          .optional()
          .describe("審查者的身份 ID 清單"),
      },
      outputSchema: createPullRequestOutputSchema,
    },
    async ({
      repositoryId,
      sourceRefName,
      targetRefName,
      title,
      description,
      descriptionFile,
      isDraft,
      reviewers,
    }: {
      repositoryId: string;
      sourceRefName: string;
      targetRefName: string;
      title: string;
      description?: string;
      descriptionFile?: string;
      isDraft?: boolean;
      reviewers?: string[];
    }) => {
      const resolvedDescription = descriptionFile ? readInputFile(descriptionFile) : description;
      const gitPullRequest: GitInterfaces.GitPullRequest = {
        sourceRefName,
        targetRefName,
        title,
        description: resolvedDescription ?? "",
        isDraft: isDraft ?? false,
        reviewers: reviewers?.map((id) => ({ id })) ?? [],
      };
      const response = await gitApi.createPullRequest(
        gitPullRequest,
        repositoryId,
        undefined,
      );
      return {
        content: [],
        structuredContent: {
          pullRequestId: response?.pullRequestId,
          url: response?.url ?? undefined,
        },
      };
    },
  );

  server.registerTool(
    "create_pull_request_thread",
    {
      description:
        "在拉取請求上建立新討論串。提供 filePath 與 lineNumber 可將討論串錨定至特定程式碼行（行號需從 get_pull_request_changes 的 unified diff 推算）",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        pullRequestId: z.number().int().positive().describe("拉取請求編號"),
        content: z.string().min(1).describe("討論串第一則留言內容"),
        filePath: z
          .string()
          .optional()
          .describe("錨定的檔案路徑（前導 /），例如 /src/app/foo.ts"),
        lineNumber: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("錨定的新檔行號（來自 unified diff 推算，需同時提供 filePath）"),
        status: z
          .enum([
            "active",
            "byDesign",
            "closed",
            "fixed",
            "pending",
            "unknown",
            "wontFix",
          ])
          .optional()
          .describe("討論串初始狀態，建立新討論串通常填 active"),
      },
      outputSchema: createPullRequestThreadOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
      content,
      filePath,
      lineNumber,
      status,
    }: {
      repositoryId: string;
      pullRequestId: number;
      content: string;
      filePath?: string;
      lineNumber?: number;
      status?:
        | "active"
        | "byDesign"
        | "closed"
        | "fixed"
        | "pending"
        | "unknown"
        | "wontFix";
    }) => {
      const statusMap: Record<string, GitInterfaces.CommentThreadStatus> = {
        unknown: GitInterfaces.CommentThreadStatus.Unknown,
        active: GitInterfaces.CommentThreadStatus.Active,
        fixed: GitInterfaces.CommentThreadStatus.Fixed,
        wontFix: GitInterfaces.CommentThreadStatus.WontFix,
        closed: GitInterfaces.CommentThreadStatus.Closed,
        byDesign: GitInterfaces.CommentThreadStatus.ByDesign,
        pending: GitInterfaces.CommentThreadStatus.Pending,
      };
      const newThread: GitInterfaces.GitPullRequestCommentThread = {
        comments: [{ parentCommentId: 0, content, commentType: 1 }],
        status: status ? statusMap[status] : undefined,
        threadContext:
          filePath && lineNumber
            ? {
                filePath,
                rightFileStart: { line: lineNumber, offset: 1 },
                rightFileEnd: { line: lineNumber, offset: 1 },
              }
            : undefined,
      };
      const response = await gitApi.createThread(
        newThread,
        repositoryId,
        pullRequestId,
        undefined,
      );
      const comments = ensureArray<GitInterfaces.Comment>(response?.comments);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          id: response?.id ?? undefined,
          status: response?.status ?? undefined,
          threadContext: response?.threadContext ?? undefined,
          comments,
        }),
      };
    },
  );

  server.registerTool(
    "update_pull_request",
    {
      description:
        "更新拉取請求（標題、說明、狀態、草稿模式）。" +
        "設定 status: \"completed\" 時可搭配 mergeStrategy、deleteSourceBranch、mergeCommitMessage 控制合併行為；" +
        "其他狀態下這些參數會被忽略並於回傳訊息中說明。",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID 或名稱"),
        pullRequestId: z.number().int().positive().describe("拉取請求編號"),
        title: z.string().optional().describe("新標題"),
        description: z.string().optional().describe("新說明（內容已存在於本機檔案時請改用 descriptionFile 以節省 output token）"),
        descriptionFile: z.string().optional().describe("【優先使用】本機檔案絕對路徑；說明內容已在本機檔案時必須用此參數取代 description，工具直接讀檔，可大幅節省 output token"),
        status: z
          .enum(["active", "abandoned", "completed"])
          .optional()
          .describe("更新狀態"),
        isDraft: z.boolean().optional().describe("切換草稿模式"),
        mergeStrategy: z
          .enum(["noFastForward", "squash", "rebase", "rebaseMerge"])
          .optional()
          .describe("合併策略（僅 status: completed 時有效）"),
        deleteSourceBranch: z
          .boolean()
          .optional()
          .describe("完成後刪除來源分支（僅 status: completed 時有效）"),
        mergeCommitMessage: z
          .string()
          .optional()
          .describe("合併 commit 訊息（僅 status: completed 時有效）"),
      },
      outputSchema: updatePullRequestOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
      title,
      description,
      descriptionFile,
      status,
      isDraft,
      mergeStrategy,
      deleteSourceBranch,
      mergeCommitMessage,
    }: {
      repositoryId: string;
      pullRequestId: number;
      title?: string;
      description?: string;
      descriptionFile?: string;
      status?: "active" | "abandoned" | "completed";
      isDraft?: boolean;
      mergeStrategy?: "noFastForward" | "squash" | "rebase" | "rebaseMerge";
      deleteSourceBranch?: boolean;
      mergeCommitMessage?: string;
    }) => {
      const resolvedDescription = descriptionFile ? readInputFile(descriptionFile) : description;
      const body: Partial<GitInterfaces.GitPullRequest> = {};
      if (title !== undefined) body.title = title;
      if (resolvedDescription !== undefined) body.description = resolvedDescription;
      if (status !== undefined) body.status = parseGitPullRequestStatus(status);
      if (isDraft !== undefined) body.isDraft = isDraft;

      if (status === "completed") {
        const pr = await gitApi.getPullRequest(repositoryId, pullRequestId, undefined);
        if (pr?.lastMergeSourceCommit) {
          body.lastMergeSourceCommit = pr.lastMergeSourceCommit;
        }
        const completionOptions: Record<string, unknown> = {};
        if (mergeStrategy !== undefined) completionOptions.mergeStrategy = mergeStrategy;
        if (deleteSourceBranch !== undefined) completionOptions.deleteSourceBranch = deleteSourceBranch;
        if (mergeCommitMessage !== undefined) completionOptions.mergeCommitMessage = mergeCommitMessage;
        if (Object.keys(completionOptions).length > 0) {
          body.completionOptions = completionOptions as GitInterfaces.GitPullRequestCompletionOptions;
        }
      }

      const response = await gitApi.updatePullRequest(
        body as GitInterfaces.GitPullRequest,
        repositoryId,
        pullRequestId,
        undefined,
      );
      return {
        content: [],
        structuredContent: {
          pullRequestId: response?.pullRequestId ?? undefined,
          title: response?.title ?? undefined,
          status: response?.status ?? undefined,
          url: response?.url ?? undefined,
          note:
            status !== "completed" && (mergeStrategy !== undefined || deleteSourceBranch !== undefined || mergeCommitMessage !== undefined)
              ? "mergeStrategy、deleteSourceBranch、mergeCommitMessage 僅在 status: completed 時有效，本次已忽略。"
              : undefined,
        },
      };
    },
  );

  server.registerTool(
    "update_pull_request_reviewer",
    {
      description:
        "設定或更新拉取請求的審查者投票（核准、拒絕等）",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        pullRequestId: z
          .number()
          .int()
          .positive()
          .describe("拉取請求編號"),
        reviewerId: z.string().min(1).describe("審查者的身份 ID"),
        vote: z
          .union([
            z.literal(10),
            z.literal(5),
            z.literal(0),
            z.literal(-5),
            z.literal(-10),
          ])
          .describe(
            "投票值：10=核准、5=核准附建議、0=無意見（重設）、-5=等待作者、-10=拒絕",
          ),
      },
      outputSchema: updatePrReviewerOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
      reviewerId,
      vote,
    }: {
      repositoryId: string;
      pullRequestId: number;
      reviewerId: string;
      vote: 10 | 5 | 0 | -5 | -10;
    }) => {
      const reviewer: GitInterfaces.IdentityRefWithVote = { vote };
      const response = await gitApi.createPullRequestReviewer(
        reviewer,
        repositoryId,
        pullRequestId,
        reviewerId,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(response ?? {}) as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "create_pull_request_thread_comment",
    {
      description: "在拉取請求的現有討論串中新增留言",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        pullRequestId: z
          .number()
          .int()
          .positive()
          .describe("拉取請求編號"),
        threadId: z.number().int().positive().describe("討論串 ID"),
        content: z.string().min(1).describe("留言內容"),
      },
      outputSchema: createPullRequestThreadCommentOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
      threadId,
      content,
    }: {
      repositoryId: string;
      pullRequestId: number;
      threadId: number;
      content: string;
    }) => {
      const comment: GitInterfaces.Comment = {
        parentCommentId: 0,
        content,
        commentType: 1,
      };
      const response = await gitApi.createComment(
        comment,
        repositoryId,
        pullRequestId,
        threadId,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(response ?? {}) as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "update_pull_request_thread",
    {
      description: "更新拉取請求評論串的狀態（例如標記為已解決）",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        pullRequestId: z
          .number()
          .int()
          .positive()
          .describe("拉取請求編號"),
        threadId: z.number().int().positive().describe("評論串 ID"),
        status: z
          .enum([
            "active",
            "byDesign",
            "closed",
            "fixed",
            "pending",
            "unknown",
            "wontFix",
          ])
          .describe(
            "新狀態：active=進行中、fixed=已修正、wontFix=不修正、closed=已關閉、byDesign=設計如此、pending=待確認",
          ),
      },
      outputSchema: updatePrThreadOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
      threadId,
      status,
    }: {
      repositoryId: string;
      pullRequestId: number;
      threadId: number;
      status:
        | "active"
        | "byDesign"
        | "closed"
        | "fixed"
        | "pending"
        | "unknown"
        | "wontFix";
    }) => {
      const statusMap: Record<string, GitInterfaces.CommentThreadStatus> = {
        unknown: GitInterfaces.CommentThreadStatus.Unknown,
        active: GitInterfaces.CommentThreadStatus.Active,
        fixed: GitInterfaces.CommentThreadStatus.Fixed,
        wontFix: GitInterfaces.CommentThreadStatus.WontFix,
        closed: GitInterfaces.CommentThreadStatus.Closed,
        byDesign: GitInterfaces.CommentThreadStatus.ByDesign,
        pending: GitInterfaces.CommentThreadStatus.Pending,
      };
      const thread: GitInterfaces.GitPullRequestCommentThread = {
        status: statusMap[status],
      };
      const response = await gitApi.updateThread(
        thread,
        repositoryId,
        pullRequestId,
        threadId,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(response ?? {}) as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "get_pull_request_changes",
    {
      description:
        "取得拉取請求的檔案變更清單（取最新一次 iteration 的變更）",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        pullRequestId: z
          .number()
          .int()
          .positive()
          .describe("拉取請求編號"),
        top: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("最多回傳的變更筆數"),
      },
      outputSchema: getPullRequestChangesOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
      top,
    }: {
      repositoryId: string;
      pullRequestId: number;
      top?: number;
    }) => {
      const iterations = await gitApi.getPullRequestIterations(
        repositoryId,
        pullRequestId,
      );
      const iterationList =
        ensureArray<GitInterfaces.GitPullRequestIteration>(iterations);
      if (iterationList.length === 0) {
        return { content: [], structuredContent: { changeEntries: [] } };
      }
      const latestIterationId = iterationList.at(-1)?.id ?? 1;
      const changes = await gitApi.getPullRequestIterationChanges(
        repositoryId,
        pullRequestId,
        latestIterationId,
        undefined,
        top,
      );
      const changeEntries = ensureArray<GitInterfaces.GitPullRequestChange>(
        changes?.changeEntries,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          changeEntries: changeEntries.map((c) => ({
            changeType: c.changeType ?? undefined,
            changeId: c.changeId ?? undefined,
            item: c.item
              ? {
                  path: (c.item as { path?: string }).path ?? undefined,
                  url: (c.item as { url?: string }).url ?? undefined,
                }
              : undefined,
          })),
        }),
      };
    },
  );

  server.registerTool(
    "get_pull_request_threads",
    {
      description: "取得拉取請求的所有討論串",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        pullRequestId: z
          .number()
          .int()
          .positive()
          .describe("拉取請求編號"),
        detail: z
          .enum(["minimal", "full"])
          .optional()
          .describe(
            "minimal（預設）每筆討論串只回傳 id、status、isDeleted、lastUpdatedDate、" +
              "threadContext.filePath，以及評論的 id/author.displayName/content（截斷至 300 字元）；" +
              "full 回傳完整欄位（含 identities 對照表等）",
          ),
      },
      outputSchema: getPullRequestThreadsOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
      detail = "minimal",
    }: {
      repositoryId: string;
      pullRequestId: number;
      detail?: "minimal" | "full";
    }) => {
      const threads = await gitApi.getThreads(
        repositoryId,
        pullRequestId,
        undefined,
      );
      const threadArr =
        ensureArray<GitInterfaces.GitPullRequestCommentThread>(threads);
      if (detail === "full") {
        return {
          content: [],
          structuredContent: normalizeAzureDevOpsDates({ threads: threadArr }),
        };
      }
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          threads: threadArr.map((t) => ({
            id: t.id ?? undefined,
            status: t.status ?? undefined,
            isDeleted: t.isDeleted ?? undefined,
            lastUpdatedDate: t.lastUpdatedDate ?? undefined,
            threadContext: t.threadContext
              ? { filePath: t.threadContext.filePath ?? undefined }
              : undefined,
            comments: ensureArray(t.comments).map((c) => {
              const raw = c as {
                id?: number;
                author?: { displayName?: string };
                content?: string;
              };
              const content = raw.content ?? "";
              return {
                id: raw.id ?? undefined,
                author: raw.author
                  ? { displayName: raw.author.displayName ?? undefined }
                  : undefined,
                content:
                  content.length > 300
                    ? content.slice(0, 300) + "…"
                    : content,
              };
            }),
          })),
        }),
      };
    },
  );

  server.registerTool(
    "get_pull_request_statuses",
    {
      description: "取得拉取請求的 CI/build 狀態清單",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        pullRequestId: z
          .number()
          .int()
          .positive()
          .describe("拉取請求編號"),
      },
      outputSchema: getPullRequestStatusesOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
    }: {
      repositoryId: string;
      pullRequestId: number;
    }) => {
      const statuses = await gitApi.getPullRequestStatuses(
        repositoryId,
        pullRequestId,
        undefined,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          statuses: ensureArray<GitInterfaces.GitPullRequestStatus>(statuses),
        }),
      };
    },
  );

  server.registerTool(
    "get_pull_request_work_items",
    {
      description:
        "取得拉取請求關聯的工作項目清單（含摘要資訊）。" +
        "若需反向建立工作項目 → PR 的關聯，請在 update_work_item 的 addRelations 中使用：" +
        "rel: \"ArtifactLink\"，url: \"vstfs:///Git/PullRequestId/{projectId}%2F{repositoryId}%2F{pullRequestId}\"，attributes: { name: \"Pull Request\" }。",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        pullRequestId: z.number().int().positive().describe("拉取請求編號"),
        project: z.string().optional().describe("專案名稱或 ID"),
      },
      outputSchema: getPullRequestWorkItemsOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
      project,
    }: {
      repositoryId: string;
      pullRequestId: number;
      project?: string;
    }) => {
      const wiRefs = await gitApi.getPullRequestWorkItemRefs(
        repositoryId,
        pullRequestId,
        project,
      );
      const refs = ensureArray<VSSInterfaces.ResourceRef>(wiRefs);
      const ids = refs
        .map((r) => {
          const idStr = r.id ?? "";
          const n = parseInt(idStr, 10);
          return isNaN(n) ? undefined : n;
        })
        .filter((n): n is number => n !== undefined);

      if (ids.length === 0) {
        return { content: [], structuredContent: { workItems: [] } };
      }

      const fields = [
        "System.Id",
        "System.Title",
        "System.State",
        "System.WorkItemType",
      ];
      const items = witApi
        ? await witApi.getWorkItems(ids, fields, undefined, undefined, undefined, project)
        : [];

      return {
        content: [],
        structuredContent: {
          workItems: ensureArray(items).map((item) => {
            const wi = item as {
              id?: number;
              fields?: Record<string, unknown>;
            };
            return {
              id: wi.id ?? undefined,
              title: wi.fields?.["System.Title"] as string | undefined,
              state: wi.fields?.["System.State"] as string | undefined,
              type: wi.fields?.["System.WorkItemType"] as string | undefined,
            };
          }),
        },
      };
    },
  );
}
