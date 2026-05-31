import type { AxiosInstance } from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from "zod";

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
          z.object({
            id: z.string().nullable(),
            name: z.string().nullable(),
            url: z.string().nullable(),
            defaultBranch: z.string().nullable(),
          }),
        ),
      }),
    },
    async ({ project }: { project: string }) => {
      const response = await client.get("git/repositories", {
        params: { project },
      });
      return {
        content: [],
        structuredContent: {
          project,
          repositories: (response.data?.value ?? []).map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            url: repo.webUrl ?? repo.remoteUrl,
            defaultBranch: repo.defaultBranch,
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
          z.object({
            pullRequestId: z.number().nullable(),
            repositoryId: z.string().nullable(),
            title: z.string().nullable(),
            status: z.string().nullable(),
            createdBy: z.string().nullable(),
            url: z.string().nullable(),
          }),
        ),
      }),
    },
    async ({ project }: { project: string }) => {
      const response = await client.get("git/pullrequests", {
        params: { project },
      });
      return {
        content: [],
        structuredContent: {
          project,
          pullRequests: (response.data?.value ?? []).map((pr: any) => ({
            pullRequestId: pr.pullRequestId,
            repositoryId: pr.repository?.id,
            title: pr.title,
            status: pr.status,
            createdBy: pr.createdBy?.displayName ?? pr.createdBy?.uniqueName,
            url: pr.url,
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
        pullRequest: z.any(),
        threads: z.array(z.any()),
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
      return {
        content: [],
        structuredContent: {
          pullRequest: detailResp.data,
          threads: threadsResp.data?.value ?? [],
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
      outputSchema: z.object({
        pullRequestId: z.number().nullable(),
        url: z.string().nullable(),
      }),
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
      outputSchema: z.object({
        threadId: z.number().nullable(),
        comments: z.array(z.any()),
      }),
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
      return {
        content: [],
        structuredContent: {
          threadId: response.data?.id,
          comments: response.data?.comments ?? [],
        },
      };
    },
  );
}
