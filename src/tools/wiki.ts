import type { IWikiApi } from "azure-devops-node-api/WikiApi";
import * as WikiInterfaces from "azure-devops-node-api/interfaces/WikiInterfaces";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  getWikisOutputSchema,
  getWikiPageOutputSchema,
  listWikiPagesOutputSchema,
  createWikiPageOutputSchema,
  updateWikiPageOutputSchema,
  searchWikiOutputSchema,
  normalizeAzureDevOpsDates,
  ensureArray,
} from "../types/azureDevOps.js";

const envSource =
  typeof Bun !== "undefined" && typeof Bun.env !== "undefined"
    ? Bun.env
    : process.env;
const ADO_BASE_URL = (envSource.AZURE_DEVOPS_URL ?? "").replace(/\/+$/, "");
const ADO_TOKEN = envSource.AZURE_DEVOPS_TOKEN ?? "";

type JsonObject = Record<string, unknown>;

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`:${ADO_TOKEN}`).toString("base64")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra,
  };
}

async function wikiRestGet(
  path: string,
): Promise<{ data: JsonObject; eTag: string | null }> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${ADO_BASE_URL}/${path}${sep}api-version=7.0`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ADO Wiki GET 失敗 ${resp.status}: ${text}`);
  }
  return {
    data: (await resp.json()) as JsonObject,
    eTag: resp.headers.get("ETag"),
  };
}

async function wikiRestPut(
  path: string,
  body: unknown,
  ifMatch?: string,
): Promise<JsonObject> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${ADO_BASE_URL}/${path}${sep}api-version=7.0`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: authHeaders(ifMatch ? { "If-Match": ifMatch } : undefined),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ADO Wiki PUT 失敗 ${resp.status}: ${text}`);
  }
  const data = (await resp.json()) as JsonObject;
  return (data.page as JsonObject) ?? data;
}

async function wikiRestPost(path: string, body: unknown): Promise<JsonObject> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${ADO_BASE_URL}/${path}${sep}api-version=7.0`;
  const resp = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ADO Wiki POST 失敗 ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<JsonObject>;
}

export function registerWikiTools(server: McpServer, wikiApi: IWikiApi): void {
  // ── get_wikis ──────────────────────────────────────────────────────────────
  server.registerTool(
    "get_wikis",
    {
      description:
        "取得專案（或 Collection）底下所有 Wiki 的列表。若本次對話中已呼叫過此工具取得相同 project 的結果，請直接使用 context 內的資料，勿重複呼叫。",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("專案名稱或 ID（不填則取 Collection 下所有 Wiki）"),
      },
      outputSchema: getWikisOutputSchema,
    },
    async ({ project }: { project?: string }) => {
      const wikis = await wikiApi.getAllWikis(project);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          wikis: ensureArray<WikiInterfaces.WikiV2>(wikis).map((w) => ({
            id: w.id ?? undefined,
            name: w.name ?? undefined,
            type: w.type ?? undefined,
            projectId: w.projectId ?? undefined,
            repositoryId: w.repositoryId ?? undefined,
            mappedPath: w.mappedPath ?? undefined,
            remoteUrl: w.remoteUrl ?? undefined,
            url: w.url ?? undefined,
            isDisabled: w.isDisabled ?? undefined,
            versions: w.versions ?? undefined,
            properties: w.properties ?? undefined,
          })),
        }),
      };
    },
  );

  // ── get_wiki_page ──────────────────────────────────────────────────────────
  server.registerTool(
    "get_wiki_page",
    {
      description: "取得 Wiki 特定頁面的內容與中繼資料。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        wikiIdentifier: z.string().min(1).describe("Wiki ID 或 Wiki 名稱"),
        path: z
          .string()
          .min(1)
          .describe("頁面路徑，例如 /MyPage 或 /Parent/Child"),
        includeContent: z
          .boolean()
          .optional()
          .default(true)
          .describe("是否包含頁面 Markdown 內容（預設 true）"),
      },
      outputSchema: getWikiPageOutputSchema,
    },
    async ({
      project,
      wikiIdentifier,
      path,
      includeContent = true,
    }: {
      project: string;
      wikiIdentifier: string;
      path: string;
      includeContent?: boolean;
    }) => {
      const encodedPath = encodeURIComponent(path);
      const { data: page } = await wikiRestGet(
        `${project}/_apis/wiki/wikis/${wikiIdentifier}/pages?path=${encodedPath}&includeContent=${includeContent}`,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(page),
      };
    },
  );

  // ── list_wiki_pages ────────────────────────────────────────────────────────
  server.registerTool(
    "list_wiki_pages",
    {
      description:
        "列出 Wiki 中的頁面清單（樹狀結構）。若本次對話中已呼叫過此工具取得相同 wiki 的結果，請直接使用 context 內的資料，勿重複呼叫。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        wikiIdentifier: z.string().min(1).describe("Wiki ID 或 Wiki 名稱"),
        path: z
          .string()
          .optional()
          .default("/")
          .describe("起始路徑（預設為根目錄 /）"),
        recursionLevel: z
          .enum([
            "none",
            "oneLevel",
            "oneLevelPlusNestedEmptyFolders",
            "full",
          ])
          .optional()
          .default("full")
          .describe("遞迴深度（預設 full 取得完整樹狀結構）"),
      },
      outputSchema: listWikiPagesOutputSchema,
    },
    async ({
      project,
      wikiIdentifier,
      path = "/",
      recursionLevel = "full",
    }: {
      project: string;
      wikiIdentifier: string;
      path?: string;
      recursionLevel?: string;
    }) => {
      const encodedPath = encodeURIComponent(path);
      const { data: page } = await wikiRestGet(
        `${project}/_apis/wiki/wikis/${wikiIdentifier}/pages?path=${encodedPath}&recursionLevel=${recursionLevel}`,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(page),
      };
    },
  );

  // ── create_wiki_page ───────────────────────────────────────────────────────
  server.registerTool(
    "create_wiki_page",
    {
      description:
        "在指定 Wiki 中建立新頁面（若頁面已存在會覆蓋）。CodeWiki 必須提供 branch。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        wikiIdentifier: z.string().min(1).describe("Wiki ID 或 Wiki 名稱"),
        path: z.string().min(1).describe("頁面路徑，例如 /NewPage"),
        content: z.string().describe("頁面 Markdown 內容"),
        branch: z
          .string()
          .optional()
          .describe("目標分支名稱（CodeWiki 必填，例如 main；ProjectWiki 可省略）"),
      },
      outputSchema: createWikiPageOutputSchema,
    },
    async ({
      project,
      wikiIdentifier,
      path,
      content,
      branch,
    }: {
      project: string;
      wikiIdentifier: string;
      path: string;
      content: string;
      branch?: string;
    }) => {
      const encodedPath = encodeURIComponent(path);
      const versionSuffix = branch
        ? `&versionDescriptor.version=${encodeURIComponent(branch)}&versionDescriptor.versionType=branch`
        : "";
      const page = await wikiRestPut(
        `${project}/_apis/wiki/wikis/${wikiIdentifier}/pages?path=${encodedPath}${versionSuffix}`,
        { content },
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(page),
      };
    },
  );

  // ── update_wiki_page ───────────────────────────────────────────────────────
  server.registerTool(
    "update_wiki_page",
    {
      description:
        "更新 Wiki 中現有頁面的內容。需提供 version（ETag）以確保樂觀鎖定，可由 get_wiki_page 回傳取得；若設為 * 則強制覆蓋。CodeWiki 必須提供 branch。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        wikiIdentifier: z.string().min(1).describe("Wiki ID 或 Wiki 名稱"),
        path: z.string().min(1).describe("頁面路徑"),
        content: z.string().describe("更新後的 Markdown 內容"),
        version: z
          .string()
          .optional()
          .describe("頁面版本（ETag），由 get_wiki_page 的回應 header 取得；不填則不帶版本鎖定"),
        branch: z
          .string()
          .optional()
          .describe("目標分支名稱（CodeWiki 必填，例如 main；ProjectWiki 可省略）"),
      },
      outputSchema: updateWikiPageOutputSchema,
    },
    async ({
      project,
      wikiIdentifier,
      path,
      content,
      version,
      branch,
    }: {
      project: string;
      wikiIdentifier: string;
      path: string;
      content: string;
      version?: string;
      branch?: string;
    }) => {
      const encodedPath = encodeURIComponent(path);
      const versionSuffix = branch
        ? `&versionDescriptor.version=${encodeURIComponent(branch)}&versionDescriptor.versionType=branch`
        : "";
      const pageGetPath = `${project}/_apis/wiki/wikis/${wikiIdentifier}/pages?path=${encodedPath}${versionSuffix}`;
      const eTag = version ?? (await wikiRestGet(pageGetPath)).eTag ?? undefined;
      const page = await wikiRestPut(
        pageGetPath,
        { content },
        eTag,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(page),
      };
    },
  );

  // ── search_wiki ────────────────────────────────────────────────────────────
  server.registerTool(
    "search_wiki",
    {
      description: "在 Wiki 中搜尋關鍵字，回傳符合的頁面清單。",
      inputSchema: {
        searchText: z.string().min(1).describe("搜尋關鍵字"),
        projectName: z
          .string()
          .optional()
          .describe("限定搜尋範圍的專案名稱（不填則搜尋所有專案）"),
        top: z
          .number()
          .int()
          .positive()
          .optional()
          .default(25)
          .describe("最多回傳筆數（預設 25）"),
        skip: z
          .number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("跳過筆數（分頁用，預設 0）"),
      },
      outputSchema: searchWikiOutputSchema,
    },
    async ({
      searchText,
      projectName,
      top = 25,
      skip = 0,
    }: {
      searchText: string;
      projectName?: string;
      top?: number;
      skip?: number;
    }) => {
      const body: JsonObject = { searchText, $top: top, $skip: skip };
      if (projectName) {
        body.filters = { Project: [projectName] };
      }
      const result = await wikiRestPost("_apis/search/wikisearchresults", body);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          count: result.count,
          results: ensureArray(result.results),
        }),
      };
    },
  );
}
