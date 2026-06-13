import type { IGitApi } from "azure-devops-node-api/GitApi";
import type { IWorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi";
import * as GitInterfaces from "azure-devops-node-api/interfaces/GitInterfaces";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { createTwoFilesPatch } from "diff";
import {
  ensureArray,
  normalizeAzureDevOpsDates,
  getPullRequestDiffOutputSchema,
  getFileContentOutputSchema,
  listBranchesOutputSchema,
  listCommitsOutputSchema,
  getCommitOutputSchema,
  searchCodeOutputSchema,
} from "../types/azureDevOps.js";
import { deliver } from "../fileHandoff.js";

const envSource =
  typeof Bun !== "undefined" && typeof Bun.env !== "undefined"
    ? Bun.env
    : process.env;
const ADO_BASE_URL = (envSource.AZURE_DEVOPS_URL ?? "").replace(/\/+$/, "");
const ADO_TOKEN = envSource.AZURE_DEVOPS_TOKEN ?? "";

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "zip", "tar", "gz", "7z", "rar", "jar", "war",
  "exe", "dll", "so", "dylib", "bin", "obj",
  "ttf", "otf", "woff", "woff2", "eot",
  "mp3", "mp4", "avi", "mov", "mkv", "wav", "flac",
  "db", "sqlite", "lock",
]);

const MAX_FILE_BYTES = 1024 * 1024; // 1 MB

function isBinaryPath(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return BINARY_EXTENSIONS.has(ext);
}

function hasBinaryContent(content: string): boolean {
  for (let i = 0; i < Math.min(content.length, 8000); i++) {
    if (content.charCodeAt(i) === 0) return true;
  }
  return false;
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`:${ADO_TOKEN}`).toString("base64")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function searchRestPost(path: string, body: unknown): Promise<Record<string, unknown>> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${ADO_BASE_URL}/${path}${sep}api-version=7.0`;
  const resp = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (resp.status === 404) {
    throw new Error("此 ADO Server 未安裝 Search extension，無法使用 search_code。");
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`程式碼搜尋 POST 失敗 ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<Record<string, unknown>>;
}

export function registerGitTools(
  server: McpServer,
  gitApi: IGitApi,
  witApi: IWorkItemTrackingApi,
): void {
  // ── get_pull_request_diff ──────────────────────────────────────────────────
  server.registerTool(
    "get_pull_request_diff",
    {
      description:
        "取得拉取請求的程式碼差異（unified diff）。可一次取全部檔案或指定單一檔案。" +
        "二進位檔案及超過 1 MB 的檔案將略過並於 skippedFiles 標註。",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID 或名稱"),
        pullRequestId: z.number().int().positive().describe("拉取請求編號"),
        project: z.string().optional().describe("專案名稱或 ID"),
        filePath: z
          .string()
          .optional()
          .describe("只取此檔案的 diff；省略時取全部變更檔案"),
        maxFiles: z
          .number()
          .int()
          .positive()
          .max(100)
          .optional()
          .describe("省略 filePath 時最多處理幾個檔案，預設 30，上限 100"),
        output: z
          .enum(["inline", "file", "auto"])
          .optional()
          .describe(
            "回傳方式：inline 直接回傳 diff 內容；file 寫入暫存檔回傳路徑；auto（預設）依大小自動判斷。",
          ),
      },
      outputSchema: getPullRequestDiffOutputSchema,
    },
    async ({
      repositoryId,
      pullRequestId,
      project,
      filePath,
      maxFiles = 30,
      output = "auto",
    }: {
      repositoryId: string;
      pullRequestId: number;
      project?: string;
      filePath?: string;
      maxFiles?: number;
      output?: "inline" | "file" | "auto";
    }) => {
      const pr = await gitApi.getPullRequest(repositoryId, pullRequestId, project);
      if (!pr) {
        return {
          content: [],
          structuredContent: { diff: "", fileCount: 0, skippedFiles: [] },
        };
      }

      const sourceCommitId = pr.lastMergeSourceCommit?.commitId;
      const targetCommitId = pr.lastMergeTargetCommit?.commitId;

      if (!sourceCommitId || !targetCommitId) {
        return {
          content: [],
          structuredContent: { diff: "", fileCount: 0, skippedFiles: [] },
        };
      }

      const iterations = await gitApi.getPullRequestIterations(
        repositoryId,
        pullRequestId,
        project,
      );
      const iterationList =
        ensureArray<GitInterfaces.GitPullRequestIteration>(iterations);
      if (iterationList.length === 0) {
        return {
          content: [],
          structuredContent: { diff: "", fileCount: 0, skippedFiles: [] },
        };
      }

      const latestIterationId = iterationList.at(-1)?.id ?? 1;
      const changes = await gitApi.getPullRequestIterationChanges(
        repositoryId,
        pullRequestId,
        latestIterationId,
        project,
      );

      let changeEntries = ensureArray<GitInterfaces.GitPullRequestChange>(
        changes?.changeEntries,
      );

      if (filePath) {
        changeEntries = changeEntries.filter(
          (c) =>
            (c.item as { path?: string } | undefined)?.path === filePath,
        );
      } else {
        changeEntries = changeEntries.slice(0, maxFiles);
      }

      const diffParts: string[] = [];
      const skippedFiles: Array<{ path: string; reason: string }> = [];

      for (const entry of changeEntries) {
        const itemPath = (entry.item as { path?: string } | undefined)?.path;
        if (!itemPath) continue;

        if (isBinaryPath(itemPath)) {
          skippedFiles.push({ path: itemPath, reason: "二進位檔案" });
          diffParts.push(`Binary file ${itemPath} changed\n`);
          continue;
        }

        const changeType = entry.changeType ?? 0;
        // changeType 1 = Add, 2 = Edit, 4 = Delete, 8 = Rename; 位元組合
        const isAdd = (changeType & 1) !== 0 && (changeType & ~1) === 0;
        const isDelete = (changeType & 4) !== 0 && (changeType & ~4) === 0;
        const isRename = (changeType & 8) !== 0;

        let baseContent = "";
        let headContent = "";

        try {
          if (!isAdd) {
            const baseStream = await gitApi.getItemText(
              repositoryId,
              itemPath,
              project,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              {
                version: targetCommitId,
                versionType: GitInterfaces.GitVersionType.Commit,
              },
            );
            baseContent = await streamToString(baseStream);
            if (baseContent.length > MAX_FILE_BYTES) {
              skippedFiles.push({ path: itemPath, reason: `檔案過大：${baseContent.length} bytes` });
              continue;
            }
            if (hasBinaryContent(baseContent)) {
              skippedFiles.push({ path: itemPath, reason: "二進位檔案內容" });
              diffParts.push(`Binary file ${itemPath} changed\n`);
              continue;
            }
          }

          if (!isDelete) {
            const headStream = await gitApi.getItemText(
              repositoryId,
              itemPath,
              project,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              {
                version: sourceCommitId,
                versionType: GitInterfaces.GitVersionType.Commit,
              },
            );
            headContent = await streamToString(headStream);
            if (headContent.length > MAX_FILE_BYTES) {
              skippedFiles.push({ path: itemPath, reason: `檔案過大：${headContent.length} bytes` });
              continue;
            }
            if (hasBinaryContent(headContent)) {
              skippedFiles.push({ path: itemPath, reason: "二進位檔案內容" });
              diffParts.push(`Binary file ${itemPath} changed\n`);
              continue;
            }
          }
        } catch {
          skippedFiles.push({ path: itemPath, reason: "讀取檔案內容失敗" });
          continue;
        }

        const originalPath = isRename
          ? (entry as { originalPath?: string }).originalPath ?? itemPath
          : itemPath;

        const patchHeader = isRename
          ? `renamed from ${originalPath}\n--- a${originalPath}\n+++ b${itemPath}\n`
          : "";

        const patch = createTwoFilesPatch(
          `a${originalPath}`,
          `b${itemPath}`,
          baseContent,
          headContent,
          "",
          "",
        );

        if (isRename && patchHeader) {
          // patch 已含 --- +++ header，只加 rename 提示行
          diffParts.push(`diff --git a${originalPath} b${itemPath}\n${patchHeader}${patch.split("\n").slice(2).join("\n")}`);
        } else {
          diffParts.push(patch);
        }
      }

      const diffText = diffParts.join("\n");
      const handoff = await deliver(diffText, {
        output,
        toolName: "get_pull_request_diff",
        key: `pr${pullRequestId}`,
        ext: "diff",
      });
      if ("savedToFile" in handoff) {
        const { savedToFile: _, ...outputFile } = handoff;
        return {
          content: [],
          structuredContent: { outputFile, fileCount: changeEntries.length, skippedFiles },
        };
      }
      return {
        content: [],
        structuredContent: {
          diff: handoff.text,
          fileCount: changeEntries.length,
          skippedFiles,
        },
      };
    },
  );

  // ── get_file_content ───────────────────────────────────────────────────────
  server.registerTool(
    "get_file_content",
    {
      description:
        "讀取儲存庫中指定檔案在某分支、commit 或 tag 的內容。" +
        "可用 startLine/endLine 只回傳部分行範圍（1-based）。",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID 或名稱"),
        path: z.string().min(1).describe("檔案路徑，以 / 開頭"),
        project: z.string().optional().describe("專案名稱或 ID"),
        ref: z
          .string()
          .optional()
          .describe("分支名、commit SHA 或 tag；省略用預設分支"),
        refType: z
          .enum(["branch", "commit", "tag"])
          .optional()
          .describe("明示 ref 的類型；省略時自動判斷（40 碼 hex 視為 commit，否則 branch）"),
        startLine: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("起始行號（1-based），與 endLine 搭配"),
        endLine: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("結束行號（1-based），省略時讀至末行"),
        output: z
          .enum(["inline", "file", "auto"])
          .optional()
          .describe(
            "回傳方式：inline 直接回傳內容；file 寫入暫存檔回傳路徑；auto（預設）依大小自動判斷。",
          ),
      },
      outputSchema: getFileContentOutputSchema,
    },
    async ({
      repositoryId,
      path,
      project,
      ref,
      refType,
      startLine,
      endLine,
      output = "auto",
    }: {
      repositoryId: string;
      path: string;
      project?: string;
      ref?: string;
      refType?: "branch" | "commit" | "tag";
      startLine?: number;
      endLine?: number;
      output?: "inline" | "file" | "auto";
    }) => {
      let versionDescriptor: GitInterfaces.GitVersionDescriptor | undefined;
      if (ref) {
        let versionType: GitInterfaces.GitVersionType;
        if (refType === "commit") {
          versionType = GitInterfaces.GitVersionType.Commit;
        } else if (refType === "tag") {
          versionType = GitInterfaces.GitVersionType.Tag;
        } else if (refType === "branch") {
          versionType = GitInterfaces.GitVersionType.Branch;
        } else {
          versionType =
            /^[0-9a-f]{40}$/i.test(ref)
              ? GitInterfaces.GitVersionType.Commit
              : GitInterfaces.GitVersionType.Branch;
        }
        versionDescriptor = { version: ref, versionType };
      }

      let content: string;
      try {
        const stream = await gitApi.getItemText(
          repositoryId,
          path,
          project,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          versionDescriptor,
        );
        content = await streamToString(stream);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          return {
            content: [{ type: "text" as const, text: `找不到檔案，請確認 path 與 ref：${path}` }],
            isError: true,
            structuredContent: { totalLines: 0 },
          };
        }
        throw err;
      }

      const allLines = content.split("\n");
      const totalLines = allLines.length;

      let returnedContent = content;
      let returnedRange: { start: number; end: number } | undefined;

      if (startLine !== undefined) {
        const start = Math.max(1, startLine);
        const end = endLine !== undefined ? Math.min(endLine, totalLines) : totalLines;
        returnedContent = allLines.slice(start - 1, end).join("\n");
        returnedRange = { start, end };
      }

      const ext = path.includes(".") ? (path.split(".").pop() ?? "txt") : "txt";
      const repoKey = repositoryId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 20);
      const pathKey = path.replace(/\//g, "_").replace(/^_/, "").slice(0, 40);
      const handoff = await deliver(returnedContent, {
        output,
        toolName: "get_file_content",
        key: `${repoKey}-${pathKey}`,
        ext,
      });
      if ("savedToFile" in handoff) {
        const { savedToFile: _, ...outputFile } = handoff;
        return { content: [], structuredContent: { outputFile, totalLines, returnedRange } };
      }
      return {
        content: [],
        structuredContent: { content: handoff.text, totalLines, returnedRange },
      };
    },
  );

  // ── list_branches ──────────────────────────────────────────────────────────
  server.registerTool(
    "list_branches",
    {
      description: "列出儲存庫的分支清單，可依名稱前綴篩選。",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID 或名稱"),
        project: z.string().optional().describe("專案名稱或 ID"),
        filter: z.string().optional().describe("分支名稱前綴篩選"),
        top: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("最多回傳筆數，預設 100"),
      },
      outputSchema: listBranchesOutputSchema,
    },
    async ({
      repositoryId,
      project,
      filter,
      top = 100,
    }: {
      repositoryId: string;
      project?: string;
      filter?: string;
      top?: number;
    }) => {
      const refsFilter = filter ? `heads/${filter}` : "heads/";
      const repo = await gitApi.getRepository(repositoryId, project);
      const defaultBranch = repo?.defaultBranch?.replace("refs/heads/", "") ?? "";

      const refs = await gitApi.getRefs(
        repositoryId,
        project,
        refsFilter,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      const list = ensureArray<GitInterfaces.GitRef>(refs).slice(0, top);

      return {
        content: [],
        structuredContent: {
          branches: list.map((r) => {
            const name = r.name?.replace("refs/heads/", "") ?? undefined;
            return {
              name,
              objectId: r.objectId ?? undefined,
              creator: r.creator
                ? {
                    displayName: r.creator.displayName ?? undefined,
                    uniqueName: r.creator.uniqueName ?? undefined,
                  }
                : undefined,
              isDefault: name !== undefined ? name === defaultBranch : undefined,
            };
          }),
        },
      };
    },
  );

  // ── list_commits ───────────────────────────────────────────────────────────
  server.registerTool(
    "list_commits",
    {
      description: "列出儲存庫的 commit 歷程，可依分支、路徑、作者、日期範圍篩選。",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID 或名稱"),
        project: z.string().optional().describe("專案名稱或 ID"),
        branch: z.string().optional().describe("分支名稱"),
        itemPath: z
          .string()
          .optional()
          .describe("只回傳觸及此路徑的 commits"),
        author: z.string().optional().describe("依作者 alias 或 displayName 篩選"),
        fromDate: z
          .string()
          .optional()
          .describe("起始日期（ISO 8601），只回傳此日期之後的 commits"),
        toDate: z
          .string()
          .optional()
          .describe("截止日期（ISO 8601），只回傳此日期之前的 commits"),
        top: z
          .number()
          .int()
          .positive()
          .max(100)
          .optional()
          .describe("最多回傳筆數，預設 20，上限 100"),
        skip: z.number().int().min(0).optional().describe("跳過筆數（分頁用）"),
      },
      outputSchema: listCommitsOutputSchema,
    },
    async ({
      repositoryId,
      project,
      branch,
      itemPath,
      author,
      fromDate,
      toDate,
      top = 20,
      skip,
    }: {
      repositoryId: string;
      project?: string;
      branch?: string;
      itemPath?: string;
      author?: string;
      fromDate?: string;
      toDate?: string;
      top?: number;
      skip?: number;
    }) => {
      const searchCriteria: GitInterfaces.GitQueryCommitsCriteria = {
        $top: top,
        $skip: skip,
        author,
        itemPath,
        fromDate,
        toDate,
      };
      if (branch) {
        searchCriteria.itemVersion = {
          version: branch,
          versionType: GitInterfaces.GitVersionType.Branch,
        };
      }

      const commits = await gitApi.getCommits(
        repositoryId,
        searchCriteria,
        project,
      );

      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          commits: ensureArray<GitInterfaces.GitCommitRef>(commits).map((c) => ({
            commitId: c.commitId ?? undefined,
            comment:
              c.comment && c.comment.length > 400
                ? c.comment.slice(0, 400) + "…"
                : (c.comment ?? undefined),
            author: c.author
              ? {
                  name: c.author.name ?? undefined,
                  email: c.author.email ?? undefined,
                  date: c.author.date ?? undefined,
                }
              : undefined,
            changeCounts: c.changeCounts
              ? (c.changeCounts as unknown as Record<string, number>)
              : undefined,
          })),
        }),
      };
    },
  );

  // ── get_commit ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_commit",
    {
      description:
        "取得單一 commit 的詳細資訊，可選擇包含變更的檔案清單（不含 diff 內容；diff 請用 get_pull_request_diff）。",
      inputSchema: {
        repositoryId: z.string().min(1).describe("儲存庫 ID 或名稱"),
        commitId: z.string().min(1).describe("commit SHA"),
        project: z.string().optional().describe("專案名稱或 ID"),
        includeChanges: z
          .boolean()
          .optional()
          .describe("是否回傳變更的檔案清單，預設 true"),
        top: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("變更檔案數上限，預設 100"),
      },
      outputSchema: getCommitOutputSchema,
    },
    async ({
      repositoryId,
      commitId,
      project,
      includeChanges = true,
      top = 100,
    }: {
      repositoryId: string;
      commitId: string;
      project?: string;
      includeChanges?: boolean;
      top?: number;
    }) => {
      const commit = await gitApi.getCommit(commitId, repositoryId, project);

      let changes: Array<{ path: string | undefined; changeType: unknown }> | undefined;
      if (includeChanges) {
        const commitChanges = await gitApi.getChanges(
          commitId,
          repositoryId,
          project,
          top,
        );
        changes = ensureArray<GitInterfaces.GitChange>(
          commitChanges?.changes,
        ).map((ch) => ({
          path: (ch.item as { path?: string } | undefined)?.path ?? undefined,
          changeType: ch.changeType ?? undefined,
        }));
      }

      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          commitId: commit?.commitId ?? undefined,
          comment: commit?.comment ?? undefined,
          author: commit?.author
            ? {
                name: commit.author.name ?? undefined,
                email: commit.author.email ?? undefined,
                date: commit.author.date ?? undefined,
              }
            : undefined,
          committer: commit?.committer
            ? {
                name: commit.committer.name ?? undefined,
                email: commit.committer.email ?? undefined,
                date: commit.committer.date ?? undefined,
              }
            : undefined,
          url: commit?.url ?? undefined,
          changes,
        }),
      };
    },
  );

  // ── search_code ────────────────────────────────────────────────────────────
  server.registerTool(
    "search_code",
    {
      description:
        "在儲存庫中搜尋程式碼關鍵字（需 ADO Server 安裝 Search extension，與 search_wiki 相同前提）。" +
        "回傳符合的檔案位置清單，不含整檔內容；需要檔案內容時請搭配 get_file_content。",
      inputSchema: {
        searchText: z.string().min(1).describe("搜尋關鍵字"),
        project: z.string().optional().describe("限定搜尋範圍的專案名稱"),
        repository: z.string().optional().describe("限定搜尋範圍的儲存庫名稱"),
        path: z.string().optional().describe("路徑前綴篩選"),
        top: z
          .number()
          .int()
          .positive()
          .max(100)
          .optional()
          .describe("最多回傳筆數，預設 20，上限 100"),
        skip: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("跳過筆數（分頁用）"),
      },
      outputSchema: searchCodeOutputSchema,
    },
    async ({
      searchText,
      project,
      repository,
      path,
      top = 20,
      skip = 0,
    }: {
      searchText: string;
      project?: string;
      repository?: string;
      path?: string;
      top?: number;
      skip?: number;
    }) => {
      const body: Record<string, unknown> = {
        searchText,
        $top: top,
        $skip: skip,
      };
      const filters: Record<string, string[]> = {};
      if (project) filters["Project"] = [project];
      if (repository) filters["Repository"] = [repository];
      if (path) filters["Path"] = [path];
      if (Object.keys(filters).length > 0) body.filters = filters;

      const apiPath = project
        ? `${project}/_apis/search/codesearchresults`
        : "_apis/search/codesearchresults";

      const result = await searchRestPost(apiPath, body);

      const results = ensureArray(result.results).map((r) => {
        const item = r as Record<string, unknown>;
        return {
          fileName: item.fileName ?? undefined,
          path: item.path ?? undefined,
          repository:
            typeof item.repository === "object" && item.repository !== null
              ? (item.repository as Record<string, unknown>).name ?? undefined
              : undefined,
          project:
            typeof item.project === "object" && item.project !== null
              ? (item.project as Record<string, unknown>).name ?? undefined
              : undefined,
          matches: ensureArray(
            (item.matches as Record<string, unknown> | undefined)?.content,
          ).map((m) => {
            const match = m as Record<string, unknown>;
            return { line: match.charOffset !== undefined ? undefined : undefined };
          }),
        };
      });

      return {
        content: [],
        structuredContent: {
          count: typeof result.count === "number" ? result.count : undefined,
          results,
        },
      };
    },
  );
}
