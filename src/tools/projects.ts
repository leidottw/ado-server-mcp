import type { AxiosInstance } from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { apiVersion } from "../client.js";
import type {
  AzureDevOpsListResponse,
  AzureDevOpsProject,
  AzureDevOpsTeam,
  AzureDevOpsTeamMember,
  SupportedApiVersion,
} from "../types/azureDevOps.js";
import {
  ensureArray,
  projectOutputSchemaByVersion,
  projectTeamMemberOutputSchemaByVersion,
  projectTeamOutputSchemaByVersion,
} from "../types/azureDevOps.js";

export function registerProjectTools(
  server: McpServer,
  client: AxiosInstance,
): void {
  server.registerTool(
    "list_projects",
    {
      description: "列出 Collection 中可存取的專案清單",
      inputSchema: {
        stateFilter: z
          .enum(["all", "createPending", "deleted", "deleting", "new", "unchanged", "wellFormed"])
          .optional()
          .describe("專案狀態篩選"),
        top: z.number().int().positive().optional().describe("最多回傳筆數"),
        skip: z.number().int().min(0).optional().describe("跳過筆數（分頁用）"),
      },
      outputSchema: z.object({
        projects: z.array(
          projectOutputSchemaByVersion[apiVersion as SupportedApiVersion],
        ),
      }),
    },
    async ({
      stateFilter,
      top,
      skip,
    }: {
      stateFilter?: string;
      top?: number;
      skip?: number;
    }) => {
      const params: Record<string, unknown> = {};
      if (stateFilter) params["stateFilter"] = stateFilter;
      if (top !== undefined) params["$top"] = top;
      if (skip !== undefined) params["$skip"] = skip;
      const response = await client.get("projects", {
        params: Object.keys(params).length > 0 ? params : undefined,
      });
      const projects = ensureArray<AzureDevOpsProject>(
        (
          response.data as
            | AzureDevOpsListResponse<AzureDevOpsProject>
            | undefined
        )?.value,
      );
      return {
        content: [],
        structuredContent: {
          projects: projects.map((project) => ({
            id: project.id ?? null,
            name: project.name ?? null,
            description: project.description ?? null,
            abbreviation: project.abbreviation ?? null,
            url: project.url ?? null,
            state: project.state ?? null,
            visibility: project.visibility ?? null,
            revision: project.revision ?? null,
            defaultTeamImageUrl: project.defaultTeamImageUrl ?? null,
            lastUpdateTime: project.lastUpdateTime ?? null,
            defaultTeam: project.defaultTeam ?? null,
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_project_teams",
    {
      description: "取得指定專案底下的團隊列表",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        mine: z
          .boolean()
          .optional()
          .describe("僅回傳我所屬的團隊"),
        top: z.number().int().positive().optional().describe("最多回傳筆數"),
        skip: z.number().int().min(0).optional().describe("跳過筆數（分頁用）"),
      },
      outputSchema: z.object({
        project: z.string(),
        teams: z.array(
          projectTeamOutputSchemaByVersion[apiVersion as SupportedApiVersion],
        ),
      }),
    },
    async ({
      project,
      mine,
      top,
      skip,
    }: {
      project: string;
      mine?: boolean;
      top?: number;
      skip?: number;
    }) => {
      const params: Record<string, unknown> = {};
      if (mine !== undefined) params["$mine"] = mine;
      if (top !== undefined) params["$top"] = top;
      if (skip !== undefined) params["$skip"] = skip;
      const response = await client.get(
        `projects/${encodeURIComponent(project)}/teams`,
        { params: Object.keys(params).length > 0 ? params : undefined },
      );
      const teams = ensureArray<AzureDevOpsTeam>(
        (response.data as AzureDevOpsListResponse<AzureDevOpsTeam> | undefined)
          ?.value,
      );
      return {
        content: [],
        structuredContent: {
          project,
          teams: teams.map((team) => ({
            id: team.id ?? null,
            name: team.name ?? null,
            description: team.description ?? null,
            url: team.url ?? null,
            identityUrl: team.identityUrl ?? null,
            projectId: team.projectId ?? null,
            projectName: team.projectName ?? null,
            isDeleted: team.isDeleted ?? null,
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_team_members",
    {
      description: "取得特定團隊的成員列表",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        teamId: z.string().min(1).describe("團隊 ID"),
        top: z.number().int().positive().optional().describe("最多回傳筆數"),
        skip: z.number().int().min(0).optional().describe("跳過筆數（分頁用）"),
      },
      outputSchema: z.object({
        project: z.string(),
        teamId: z.string(),
        members: z.array(
          projectTeamMemberOutputSchemaByVersion[
            apiVersion as SupportedApiVersion
          ],
        ),
      }),
    },
    async ({
      project,
      teamId,
      top,
      skip,
    }: {
      project: string;
      teamId: string;
      top?: number;
      skip?: number;
    }) => {
      const params: Record<string, unknown> = {};
      if (top !== undefined) params["$top"] = top;
      if (skip !== undefined) params["$skip"] = skip;
      const response = await client.get(
        `projects/${encodeURIComponent(project)}/teams/${encodeURIComponent(teamId)}/members`,
        { params: Object.keys(params).length > 0 ? params : undefined },
      );
      const members = ensureArray<AzureDevOpsTeamMember>(
        (
          response.data as
            | AzureDevOpsListResponse<AzureDevOpsTeamMember>
            | undefined
        )?.value,
      );
      return {
        content: [],
        structuredContent: {
          project,
          teamId,
          members: members.map((member) => ({
            id: member.id ?? null,
            displayName:
              member.identity?.displayName ?? member.displayName ?? null,
            uniqueName:
              member.identity?.uniqueName ?? member.uniqueName ?? null,
            url: member.url ?? null,
            imageUrl: member.identity?.imageUrl ?? member.imageUrl ?? null,
            descriptor:
              member.identity?.descriptor ?? member.descriptor ?? null,
            isTeamAdmin: member.isTeamAdmin ?? null,
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_project",
    {
      description: "取得單一專案的詳細資訊",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
      },
      outputSchema:
        projectOutputSchemaByVersion[apiVersion as SupportedApiVersion],
    },
    async ({ project }: { project: string }) => {
      const response = await client.get(
        `projects/${encodeURIComponent(project)}`,
      );
      const p = response.data as AzureDevOpsProject;
      return {
        content: [],
        structuredContent: {
          id: p.id ?? null,
          name: p.name ?? null,
          description: p.description ?? null,
          abbreviation: p.abbreviation ?? null,
          url: p.url ?? null,
          state: p.state ?? null,
          visibility: p.visibility ?? null,
          revision: p.revision ?? null,
          defaultTeamImageUrl: p.defaultTeamImageUrl ?? null,
          lastUpdateTime: p.lastUpdateTime ?? null,
          defaultTeam: p.defaultTeam ?? null,
        },
      };
    },
  );

  server.registerTool(
    "get_team",
    {
      description: "取得特定團隊的詳細資訊",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        teamId: z.string().min(1).describe("團隊 ID 或名稱"),
      },
      outputSchema:
        projectTeamOutputSchemaByVersion[apiVersion as SupportedApiVersion],
    },
    async ({ project, teamId }: { project: string; teamId: string }) => {
      const response = await client.get(
        `projects/${encodeURIComponent(project)}/teams/${encodeURIComponent(teamId)}`,
      );
      const team = response.data as AzureDevOpsTeam;
      return {
        content: [],
        structuredContent: {
          id: team.id ?? null,
          name: team.name ?? null,
          description: team.description ?? null,
          url: team.url ?? null,
          identityUrl: team.identityUrl ?? null,
          projectId: team.projectId ?? null,
          projectName: team.projectName ?? null,
          isDeleted: team.isDeleted ?? null,
        },
      };
    },
  );
}
