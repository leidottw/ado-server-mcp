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
      description: "取得指定專案下的所有 Git 拉取請求",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
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
    async ({ project }: { project: string }) => {
      const response = await client.get("git/pullrequests", {
        params: { project },
      });
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
      },
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
    }: {
      repositoryId: string;
      sourceRefName: string;
      targetRefName: string;
      title: string;
      description?: string;
    }) => {
      const response = await client.post(
        `git/repositories/${encodeURIComponent(repositoryId)}/pullrequests`,
        {
          sourceRefName,
          targetRefName,
          title,
          description: description ?? "",
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
}
