import type { AxiosInstance } from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { apiVersion } from "../client.js";
import type {
  AzureDevOpsComment,
  AzureDevOpsCommentThread,
  AzureDevOpsListResponse,
  AzureDevOpsPullRequestDetail,
  AzureDevOpsPullRequestSummary,
  AzureDevOpsRepository,
  SupportedApiVersion,
} from "../types/azureDevOps.js";
import {
  ensureArray,
  createPullRequestCommentOutputSchemaByVersion,
  createPullRequestOutputSchemaByVersion,
  pullRequestDetailOutputSchemaByVersion,
  pullRequestSummaryOutputSchemaByVersion,
  pullRequestThreadOutputSchemaByVersion,
  repositoryOutputSchemaByVersion,
  updatePullRequestOutputSchemaByVersion,
  updatePullRequestThreadOutputSchemaByVersion,
} from "../types/azureDevOps.js";

export function registerPullRequestTools(
  server: McpServer,
  client: AxiosInstance,
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
        repositories: z.array(
          repositoryOutputSchemaByVersion[apiVersion as SupportedApiVersion],
        ),
      }),
    },
    async ({ project }: { project: string }) => {
      const response = await client.get("git/repositories", {
        params: { project },
      });
      const repositories = ensureArray<AzureDevOpsRepository>(
        (
          response.data as
            | AzureDevOpsListResponse<AzureDevOpsRepository>
            | undefined
        )?.value,
      );
      return {
        content: [],
        structuredContent: {
          project,
          repositories: repositories.map((repo) => ({
            id: repo.id ?? null,
            name: repo.name ?? null,
            url: repo.webUrl ?? repo.remoteUrl ?? null,
            defaultBranch: repo.defaultBranch ?? null,
            remoteUrl: repo.remoteUrl ?? null,
            sshUrl: repo.sshUrl ?? null,
            projectId: repo.project?.id ?? null,
            projectName: repo.project?.name ?? null,
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
        pullRequests: z.array(
          pullRequestSummaryOutputSchemaByVersion[
            apiVersion as SupportedApiVersion
          ],
        ),
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
      status?: string;
      repositoryId?: string;
      creatorId?: string;
      reviewerId?: string;
      sourceRefName?: string;
      targetRefName?: string;
      top?: number;
      skip?: number;
    }) => {
      const params: Record<string, unknown> = { project };
      if (status) params["searchCriteria.status"] = status;
      if (repositoryId) params["searchCriteria.repositoryId"] = repositoryId;
      if (creatorId) params["searchCriteria.creatorId"] = creatorId;
      if (reviewerId) params["searchCriteria.reviewerId"] = reviewerId;
      if (sourceRefName)
        params["searchCriteria.sourceRefName"] = sourceRefName;
      if (targetRefName)
        params["searchCriteria.targetRefName"] = targetRefName;
      if (top !== undefined) params["$top"] = top;
      if (skip !== undefined) params["$skip"] = skip;
      const response = await client.get("git/pullrequests", { params });
      const pullRequests = ensureArray<AzureDevOpsPullRequestSummary>(
        (
          response.data as
            | AzureDevOpsListResponse<AzureDevOpsPullRequestSummary>
            | undefined
        )?.value,
      );
      return {
        content: [],
        structuredContent: {
          project,
          pullRequests: pullRequests.map((pr) => ({
            pullRequestId: pr.pullRequestId ?? null,
            repositoryId: pr.repository?.id ?? null,
            title: pr.title ?? null,
            status: pr.status ?? null,
            sourceRefName: pr.sourceRefName ?? null,
            targetRefName: pr.targetRefName ?? null,
            creationDate: pr.creationDate ?? null,
            mergeStatus: pr.mergeStatus ?? null,
            createdBy:
              pr.createdBy?.displayName ?? pr.createdBy?.uniqueName ?? null,
            url: pr.url ?? null,
          })),
        },
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
        pullRequest:
          pullRequestDetailOutputSchemaByVersion[
            apiVersion as SupportedApiVersion
          ],
        threads: z.array(
          pullRequestThreadOutputSchemaByVersion[
            apiVersion as SupportedApiVersion
          ],
        ),
      }),
    },
    async ({
      repositoryId,
      pullRequestId,
    }: {
      repositoryId: string;
      pullRequestId: number;
    }) => {
      const [detailResp, threadsResp] = await Promise.all([
        client.get(
          `git/repositories/${encodeURIComponent(repositoryId)}/pullRequests/${pullRequestId}`,
        ),
        client.get(
          `git/repositories/${encodeURIComponent(repositoryId)}/pullRequests/${pullRequestId}/threads`,
        ),
      ]);
      const pullRequest = detailResp.data as AzureDevOpsPullRequestDetail;
      const threads = ensureArray<AzureDevOpsCommentThread>(
        (
          threadsResp.data as
            | AzureDevOpsListResponse<AzureDevOpsCommentThread>
            | undefined
        )?.value,
      );
      return {
        content: [],
        structuredContent: {
          pullRequest,
          threads,
        },
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
        isDraft: z.boolean().optional().describe("是否建立為草稿 PR"),        reviewers: z
          .array(z.string())
          .optional()
          .describe("審查者的身份 ID 清單"),      },
      outputSchema:
        createPullRequestOutputSchemaByVersion[
          apiVersion as SupportedApiVersion
        ],
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
      const response = await client.post(
        `git/repositories/${encodeURIComponent(repositoryId)}/pullrequests`,
        {
          sourceRefName,
          targetRefName,
          title,
          description: description ?? "",
          isDraft: isDraft ?? false,
          reviewers: reviewers?.map((id) => ({ id })) ?? [],
        },
      );
      return {
        content: [],
        structuredContent: {
          pullRequestId: response.data?.pullRequestId,
          url: response.data?.url ?? null,
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
      outputSchema:
        createPullRequestCommentOutputSchemaByVersion[
          apiVersion as SupportedApiVersion
        ],
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
      const response = await client.post(
        `git/repositories/${encodeURIComponent(repositoryId)}/pullRequests/${pullRequestId}/threads`,
        {
          comments: [
            {
              parentCommentId: 0,
              content,
              commentType: 1,
            },
          ],
        },
      );
      const comments = ensureArray<AzureDevOpsComment>(response.data?.comments);
      return {
        content: [],
        structuredContent: {
          threadId: response.data?.id,
          comments,
        },
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
      outputSchema:
        updatePullRequestOutputSchemaByVersion[
          apiVersion as SupportedApiVersion
        ],
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
      status?: string;
      isDraft?: boolean;
    }) => {
      const body: Record<string, unknown> = {};
      if (title !== undefined) body["title"] = title;
      if (description !== undefined) body["description"] = description;
      if (status !== undefined) body["status"] = status;
      if (isDraft !== undefined) body["isDraft"] = isDraft;
      const response = await client.patch(
        `git/repositories/${encodeURIComponent(repositoryId)}/pullRequests/${pullRequestId}`,
        body,
      );
      return {
        content: [],
        structuredContent: {
          pullRequestId: response.data?.pullRequestId ?? null,
          title: response.data?.title ?? null,
          status: response.data?.status ?? null,
          url: response.data?.url ?? null,
        },
      };
    },
  );

  server.registerTool(
    "update_pull_request_thread",
    {
      description: "更新拉取請求對話串狀態（例如標記為已解決）",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID 或名稱"),
        pullRequestId: z.number().int().positive().describe("拉取請求編號"),
        threadId: z.number().int().positive().describe("對話串 ID"),
        status: z
          .enum([
            "active",
            "byPolicy",
            "closed",
            "fixed",
            "pending",
            "unknown",
            "wontFix",
          ])
          .describe("新的對話串狀態"),
      },
      outputSchema:
        updatePullRequestThreadOutputSchemaByVersion[
          apiVersion as SupportedApiVersion
        ],
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
      status: string;
    }) => {
      const response = await client.patch(
        `git/repositories/${encodeURIComponent(repositoryId)}/pullRequests/${pullRequestId}/threads/${threadId}`,
        { status },
      );
      return {
        content: [],
        structuredContent: {
          id: response.data?.id ?? null,
          status: response.data?.status ?? null,
          url: response.data?.url ?? null,
        },
      };
    },
  );
}
