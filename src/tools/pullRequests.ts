import type { IGitApi } from "azure-devops-node-api/GitApi";
import * as GitInterfaces from "azure-devops-node-api/interfaces/GitInterfaces";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  ensureArray,
  normalizeAzureDevOpsDates,
  createPullRequestCommentOutputSchema,
  createPullRequestOutputSchema,
  getPullRequestFileChangesOutputSchema,
  pullRequestDetailOutputSchema,
  pullRequestSummaryOutputSchema,
  pullRequestThreadOutputSchema,
  repositoryOutputSchema,
  replyPrThreadCommentOutputSchema,
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
): void {
  server.registerTool(
    "get_repositories",
    {
      description: "列出指定專案內的 Git 儲存庫",
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
          ).map((pr) => ({
            pullRequestId: pr.pullRequestId ?? undefined,
            repositoryId: pr.repository?.id ?? undefined,
            title: pr.title ?? undefined,
            status: pr.status ?? undefined,
            sourceRefName: pr.sourceRefName ?? undefined,
            targetRefName: pr.targetRefName ?? undefined,
            creationDate: pr.creationDate ?? undefined,
            mergeStatus: pr.mergeStatus ?? undefined,
            createdBy: pr.createdBy ?? undefined,
            url: pr.url ?? undefined,
          })),
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
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        sourceRefName: z
          .string()
          .min(1)
          .describe("來源分支名稱，例如 refs/heads/feature"),
        targetRefName: z
          .string()
          .min(1)
          .describe("目標分支名稱，例如 refs/heads/main"),
        title: z.string().min(1).describe("拉取請求標題"),
        description: z.string().optional().describe("說明內容"),
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
      isDraft,
      reviewers,
    }: {
      repositoryId: string;
      sourceRefName: string;
      targetRefName: string;
      title: string;
      description?: string;
      isDraft?: boolean;
      reviewers?: string[];
    }) => {
      const gitPullRequest: GitInterfaces.GitPullRequest = {
        sourceRefName,
        targetRefName,
        title,
        description: description ?? "",
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
    "create_pull_request_comment",
    {
      description: "在拉取請求上建立新評論回覆串",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        pullRequestId: z.number().int().positive().describe("拉取請求編號"),
        content: z.string().min(1).describe("評論內容"),
      },
      outputSchema: createPullRequestCommentOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
      content,
    }: {
      repositoryId: string;
      pullRequestId: number;
      content: string;
    }) => {
      const newThread: GitInterfaces.GitPullRequestCommentThread = {
        comments: [
          {
            parentCommentId: 0,
            content,
            commentType: 1,
          },
        ],
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
          comments,
        }),
      };
    },
  );

  server.registerTool(
    "update_pull_request",
    {
      description: "更新拉取請求（標題、說明、狀態、草稿模式）",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID 或名稱"),
        pullRequestId: z.number().int().positive().describe("拉取請求編號"),
        title: z.string().optional().describe("新標題"),
        description: z.string().optional().describe("新說明"),
        status: z
          .enum(["active", "abandoned", "completed"])
          .optional()
          .describe("更新狀態"),
        isDraft: z.boolean().optional().describe("切換草稿模式"),
      },
      outputSchema: updatePullRequestOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
      title,
      description,
      status,
      isDraft,
    }: {
      repositoryId: string;
      pullRequestId: number;
      title?: string;
      description?: string;
      status?: "active" | "abandoned" | "completed";
      isDraft?: boolean;
    }) => {
      const body: Partial<GitInterfaces.GitPullRequest> = {};
      if (title !== undefined) body.title = title;
      if (description !== undefined) body.description = description;
      if (status !== undefined) body.status = parseGitPullRequestStatus(status);
      if (isDraft !== undefined) body.isDraft = isDraft;
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
        structuredContent: normalizeAzureDevOpsDates(response ?? {}),
      };
    },
  );

  server.registerTool(
    "reply_pull_request_thread",
    {
      description: "在拉取請求的現有評論串中新增回覆",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID"),
        pullRequestId: z
          .number()
          .int()
          .positive()
          .describe("拉取請求編號"),
        threadId: z.number().int().positive().describe("評論串 ID"),
        content: z.string().min(1).describe("回覆內容"),
      },
      outputSchema: replyPrThreadCommentOutputSchema,
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
        structuredContent: normalizeAzureDevOpsDates(response ?? {}),
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
        structuredContent: normalizeAzureDevOpsDates(response ?? {}),
      };
    },
  );

  server.registerTool(
    "get_pull_request_file_changes",
    {
      description:
        "取得拉取請求的檔案變更清單（最後一次 iteration 的 diff）",
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
      outputSchema: getPullRequestFileChangesOutputSchema,
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
      const latestIterationId =
        iterationList[iterationList.length - 1].id ?? 1;
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
}
