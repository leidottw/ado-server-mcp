import type { IWikiApi } from "azure-devops-node-api/WikiApi";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as WikiInterfaces from "azure-devops-node-api/interfaces/WikiInterfaces";
import * as z from "zod";

import { deliver, readInputFile } from "../fileHandoff.js";
import {
  createWikiPageOutputSchema,
  deleteWikiPageOutputSchema,
  ensureArray,
  getWikiPageOutputSchema,
  getWikisOutputSchema,
  listWikiPagesOutputSchema,
  normalizeAzureDevOpsDates,
  searchWikiOutputSchema,
  updateWikiPageOutputSchema,
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

async function wikiRestDelete(path: string): Promise<JsonObject> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${ADO_BASE_URL}/${path}${sep}api-version=7.0`;
  const resp = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ADO Wiki DELETE 失敗 ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<JsonObject>;
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
        "取得專案（或 Collection）底下所有 Wiki 的列表。回傳結果中的 type 欄位標示該 Wiki 是 projectWiki 或 codeWiki：呼叫 create_wiki_page / update_wiki_page / delete_wiki_page 前務必先確認此欄位，codeWiki 一律要帶 branch 參數，projectWiki 一律不要帶。若本次對話中已呼叫過此工具取得相同 project 的結果，請直接使用 context 內的資料，勿重複呼叫。",
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
          .describe(
            "Wiki 頁面的邏輯路徑（用空白分隔詞語，不含 .md 副檔名），例如 /MyPage 或 /Parent Page/Child Page。" +
              "不確定確切路徑時，先呼叫 list_wiki_pages 取得頁面樹再使用其中的 path 欄位；" +
              "切勿直接套用 search_wiki 回傳結果中的 path / fileName（那是底層 git 檔案路徑，格式不同，會以連字號取代空白並含 .md，直接帶入會 404）。",
          ),
        includeContent: z
          .boolean()
          .optional()
          .default(true)
          .describe("是否包含頁面 Markdown 內容（預設 true）"),
        output: z
          .enum(["inline", "file", "auto"])
          .optional()
          .describe(
            "回傳方式：inline 直接回傳內容；file 寫入暫存檔回傳路徑；auto（預設）依大小自動判斷。大型 Wiki 頁面建議 file。",
          ),
      },
      outputSchema: getWikiPageOutputSchema,
    },
    async ({
      project,
      wikiIdentifier,
      path,
      includeContent = true,
      output = "auto",
    }: {
      project: string;
      wikiIdentifier: string;
      path: string;
      includeContent?: boolean;
      output?: "inline" | "file" | "auto";
    }) => {
      const encodedPath = encodeURIComponent(path);
      const { data: page } = await wikiRestGet(
        `${project}/_apis/wiki/wikis/${wikiIdentifier}/pages?path=${encodedPath}&includeContent=${includeContent}`,
      );
      const pageObj = page as Record<string, unknown>;
      const pageContent =
        typeof pageObj["content"] === "string" ? pageObj["content"] : "";

      if (includeContent && pageContent) {
        const sanitizedPath = (path as string)
          .replace(/\//g, "_")
          .replace(/^_/, "");
        const handoff = await deliver(pageContent, {
          output,
          toolName: "get_wiki_page",
          key: `${wikiIdentifier}-${sanitizedPath}`,
          ext: "md",
        });
        if ("savedToFile" in handoff) {
          const { savedToFile: _, ...outputFile } = handoff;
          const { content: _c, ...rest } = pageObj;
          return {
            content: [],
            structuredContent: normalizeAzureDevOpsDates({
              ...rest,
              outputFile,
            }),
          };
        }
      }
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
          .describe(
            "起始路徑（預設為根目錄 /），格式為 Wiki 頁面的邏輯路徑（空白分隔，不含 .md），" +
              "不是底層 git 檔案路徑；不確定時留空從根目錄展開即可，不要套用 search_wiki 回傳的 path / fileName。",
          ),
        recursionLevel: z
          .enum(["none", "oneLevel", "oneLevelPlusNestedEmptyFolders", "full"])
          .optional()
          .default("full")
          .describe("遞迴深度（預設 full 取得完整樹狀結構）"),
        detail: z
          .enum(["minimal", "full"])
          .optional()
          .describe(
            "minimal（預設）只回傳路徑與結構欄位，省略頁面內容；full 回傳完整欄位（含 content）",
          ),
      },
      outputSchema: listWikiPagesOutputSchema,
    },
    async ({
      project,
      wikiIdentifier,
      path = "/",
      recursionLevel = "full",
      detail = "minimal",
    }: {
      project: string;
      wikiIdentifier: string;
      path?: string;
      recursionLevel?: string;
      detail?: "minimal" | "full";
    }) => {
      const encodedPath = encodeURIComponent(path);
      const { data: page } = await wikiRestGet(
        `${project}/_apis/wiki/wikis/${wikiIdentifier}/pages?path=${encodedPath}&recursionLevel=${recursionLevel}`,
      );
      const result = detail === "minimal" ? stripWikiPageFull(page) : page;
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(result),
      };
    },
  );

  // ── create_wiki_page ───────────────────────────────────────────────────────
  server.registerTool(
    "create_wiki_page",
    {
      description:
        "在指定 Wiki 中建立新頁面（若頁面已存在會覆蓋）。建立前請先以 get_wikis 確認該 wiki 的 type：" +
        "codeWiki 必須提供 branch，否則 API 會回 400；projectWiki 不要提供 branch。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        wikiIdentifier: z.string().min(1).describe("Wiki ID 或 Wiki 名稱"),
        path: z
          .string()
          .min(1)
          .describe(
            "Wiki 頁面的邏輯路徑，例如 /NewPage（空白分隔，不含 .md），與 list_wiki_pages 回傳的 path 格式一致。",
          ),
        content: z
          .string()
          .optional()
          .describe(
            "頁面 Markdown 內容（內容已存在於本機檔案時請改用 contentFile 以節省 output token）",
          ),
        contentFile: z
          .string()
          .optional()
          .describe(
            "【優先使用】本機檔案絕對路徑；內容已在本機檔案時必須用此參數取代 content，工具直接讀檔，可大幅節省 output token",
          ),
        branch: z
          .string()
          .optional()
          .describe(
            "目標分支名稱，例如 main。是否需填寫取決於 wiki 類型，請先用 get_wikis 確認：" +
              "type 為 codeWiki 必填；type 為 projectWiki 不要填。",
          ),
      },
      outputSchema: createWikiPageOutputSchema,
    },
    async ({
      project,
      wikiIdentifier,
      path,
      content,
      contentFile,
      branch,
    }: {
      project: string;
      wikiIdentifier: string;
      path: string;
      content?: string;
      contentFile?: string;
      branch?: string;
    }) => {
      const resolvedContent = contentFile
        ? readInputFile(contentFile)
        : content;
      if (!resolvedContent)
        throw new Error("content 或 contentFile 必須提供其一");
      const encodedPath = encodeURIComponent(path);
      const versionSuffix = branch
        ? `&versionDescriptor.version=${encodeURIComponent(branch)}&versionDescriptor.versionType=branch`
        : "";
      const page = await wikiRestPut(
        `${project}/_apis/wiki/wikis/${wikiIdentifier}/pages?path=${encodedPath}${versionSuffix}`,
        { content: resolvedContent },
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
        "更新 Wiki 中現有頁面的內容。更新前請先以 get_wikis 確認該 wiki 的 type 來決定要帶哪個鎖定參數，兩者互斥，不要同時帶：" +
        "type 為 projectWiki → 帶 version（ETag，由 get_wiki_page 回應取得；不確定可填 * 強制覆蓋）；" +
        "type 為 codeWiki → 改帶 branch（例如 main），不要帶 version（codeWiki 不支援 ETag 樂觀鎖定，帶 version 會回 400）。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        wikiIdentifier: z.string().min(1).describe("Wiki ID 或 Wiki 名稱"),
        path: z
          .string()
          .min(1)
          .describe(
            "Wiki 頁面的邏輯路徑（空白分隔，不含 .md），與 list_wiki_pages 回傳的 path 格式一致，" +
              "不要套用 search_wiki 回傳結果中的 path / fileName（那是底層 git 檔案路徑）。",
          ),
        content: z
          .string()
          .optional()
          .describe(
            "更新後的 Markdown 內容（內容已存在於本機檔案時請改用 contentFile 以節省 output token）",
          ),
        contentFile: z
          .string()
          .optional()
          .describe(
            "【優先使用】本機檔案絕對路徑；內容已在本機檔案時必須用此參數取代 content，工具直接讀檔，可大幅節省 output token",
          ),
        version: z
          .string()
          .optional()
          .describe(
            "僅用於 projectWiki：頁面版本（ETag），由 get_wiki_page 的回應 header 取得；填 * 可強制覆蓋。" +
              "若 wiki 是 codeWiki，不要帶此參數，改帶 branch（codeWiki 帶 version 會回 400 versionType 錯誤）。",
          ),
        branch: z
          .string()
          .optional()
          .describe(
            "僅用於 codeWiki：目標分支名稱，例如 main，codeWiki 必填。projectWiki 不要填此參數，改用 version。",
          ),
      },
      outputSchema: updateWikiPageOutputSchema,
    },
    async ({
      project,
      wikiIdentifier,
      path,
      content,
      contentFile,
      version,
      branch,
    }: {
      project: string;
      wikiIdentifier: string;
      path: string;
      content?: string;
      contentFile?: string;
      version?: string;
      branch?: string;
    }) => {
      const resolvedContent = contentFile
        ? readInputFile(contentFile)
        : content;
      if (!resolvedContent)
        throw new Error("content 或 contentFile 必須提供其一");
      const encodedPath = encodeURIComponent(path);
      const versionSuffix = branch
        ? `&versionDescriptor.version=${encodeURIComponent(branch)}&versionDescriptor.versionType=branch`
        : "";
      const pageGetPath = `${project}/_apis/wiki/wikis/${wikiIdentifier}/pages?path=${encodedPath}${versionSuffix}`;
      const eTag =
        version ?? (await wikiRestGet(pageGetPath)).eTag ?? undefined;
      const page = await wikiRestPut(
        pageGetPath,
        { content: resolvedContent },
        eTag,
      );
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates(page),
      };
    },
  );

  // ── delete_wiki_page ───────────────────────────────────────────────────────
  server.registerTool(
    "delete_wiki_page",
    {
      description:
        "刪除 Wiki 中的指定頁面。刪除前請先以 get_wikis 確認該 wiki 的 type：" +
        "codeWiki 必須提供 branch，否則 API 會回 400；projectWiki 不要提供 branch。",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        wikiIdentifier: z.string().min(1).describe("Wiki ID 或 Wiki 名稱"),
        path: z
          .string()
          .min(1)
          .describe(
            "Wiki 頁面的邏輯路徑（空白分隔，不含 .md），與 list_wiki_pages 回傳的 path 格式一致，" +
              "不要套用 search_wiki 回傳結果中的 path / fileName（那是底層 git 檔案路徑）。",
          ),
        branch: z
          .string()
          .optional()
          .describe(
            "目標分支名稱，例如 main。是否需填寫取決於 wiki 類型，請先用 get_wikis 確認：" +
              "type 為 codeWiki 必填；type 為 projectWiki 不要填。",
          ),
        comment: z.string().optional().describe("刪除時的 commit 說明（選填）"),
      },
      outputSchema: deleteWikiPageOutputSchema,
    },
    async ({
      project,
      wikiIdentifier,
      path,
      branch,
      comment,
    }: {
      project: string;
      wikiIdentifier: string;
      path: string;
      branch?: string;
      comment?: string;
    }) => {
      const encodedPath = encodeURIComponent(path);
      let query = `path=${encodedPath}`;
      if (branch) {
        query += `&versionDescriptor.version=${encodeURIComponent(branch)}&versionDescriptor.versionType=branch`;
      }
      if (comment) {
        query += `&comment=${encodeURIComponent(comment)}`;
      }
      const page = await wikiRestDelete(
        `${project}/_apis/wiki/wikis/${wikiIdentifier}/pages?${query}`,
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
      description:
        "在 Wiki 中搜尋關鍵字，回傳符合的頁面清單。注意：回傳結果中的 path / fileName 是底層 git 檔案路徑" +
        "（連字號分隔、含 .md 副檔名），不是 get_wiki_page / list_wiki_pages / update_wiki_page / delete_wiki_page 等" +
        "工具所需的頁面邏輯路徑，不要直接拿來當這些工具的 path 參數使用；需要正確路徑時請改用 list_wiki_pages 查頁面樹。",
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

function stripWikiPageFull(page: unknown): Record<string, unknown> {
  if (!page || typeof page !== "object") return {};
  const p = page as Record<string, unknown>;
  return {
    id: p["id"],
    path: p["path"],
    order: p["order"],
    isParentPage: p["isParentPage"],
    subPages: Array.isArray(p["subPages"])
      ? p["subPages"].map(stripWikiPageFull)
      : undefined,
  };
}
