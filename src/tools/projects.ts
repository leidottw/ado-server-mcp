import type { ICoreApi } from "azure-devops-node-api/CoreApi";
import type * as CoreInterfaces from "azure-devops-node-api/interfaces/CoreInterfaces";
import type * as VSSInterfaces from "azure-devops-node-api/interfaces/common/VSSInterfaces";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  ensureArray,
  normalizeAzureDevOpsDates,
  projectOutputSchema,
  projectTeamMemberOutputSchema,
  projectTeamOutputSchema,
} from "../types/azureDevOps.js";

export function registerProjectTools(
  server: McpServer,
  coreApi: ICoreApi,
): void {
  server.registerTool(
    "list_projects",
    {
      description: "列出 Collection 中可存取的專案清單",
      inputSchema: {
        stateFilter: z
          .enum([
            "all",
            "createPending",
            "deleted",
            "deleting",
            "new",
            "unchanged",
            "wellFormed",
          ])
          .optional()
          .describe("專案狀態篩選"),
        top: z.number().int().positive().optional().describe("最多回傳筆數"),
        skip: z.number().int().min(0).optional().describe("跳過筆數（分頁用）"),
      },
      outputSchema: z.object({
        projects: z.array(projectOutputSchema),
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
      const projects = await coreApi.getProjects(stateFilter, top, skip);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          projects: ensureArray<CoreInterfaces.WebApiProject>(projects).map(
            (project) => ({
              id: project.id ?? undefined,
              name: project.name ?? undefined,
              description: project.description ?? undefined,
              abbreviation: project.abbreviation ?? undefined,
              url: project.url ?? undefined,
              state: project.state ?? undefined,
              visibility: project.visibility ?? undefined,
              revision: project.revision ?? undefined,
              defaultTeamImageUrl: project.defaultTeamImageUrl ?? undefined,
              lastUpdateTime: project.lastUpdateTime ?? undefined,
              defaultTeam: project.defaultTeam ?? undefined,
            }),
          ),
        }),
      };
    },
  );

  server.registerTool(
    "get_project_teams",
    {
      description: "取得指定專案底下的團隊列表",
      inputSchema: {
        project: z.string().min(1).describe("專案名稱或 ID"),
        mine: z.boolean().optional().describe("僅回傳我所屬的團隊"),
        top: z.number().int().positive().optional().describe("最多回傳筆數"),
        skip: z.number().int().min(0).optional().describe("跳過筆數（分頁用）"),
      },
      outputSchema: z.object({
        project: z.string(),
        teams: z.array(projectTeamOutputSchema),
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
      const teams = await coreApi.getTeams(project, mine, top, skip);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          project,
          teams: ensureArray<CoreInterfaces.WebApiTeam>(teams).map((team) => ({
            id: team.id ?? undefined,
            name: team.name ?? undefined,
            description: team.description ?? undefined,
            url: team.url ?? undefined,
            identityUrl: team.identityUrl ?? undefined,
            projectId: team.projectId ?? undefined,
            projectName: team.projectName ?? undefined,
          })),
        }),
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
        members: z.array(projectTeamMemberOutputSchema),
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
      const members = await coreApi.getTeamMembersWithExtendedProperties(
        teamId,
        project,
        top,
        skip,
      );
      return {
        content: [],
        structuredContent: {
          project,
          teamId,
          members: ensureArray<VSSInterfaces.TeamMember>(members).map(
            (member) => ({
              identity: member.identity
                ? {
                    id: member.identity.id ?? undefined,
                    displayName: member.identity.displayName ?? undefined,
                    uniqueName: member.identity.uniqueName ?? undefined,
                    url: member.identity.url ?? undefined,
                    imageUrl: member.identity.imageUrl ?? undefined,
                    descriptor: member.identity.descriptor ?? undefined,
                  }
                : undefined,
              isTeamAdmin: member.isTeamAdmin ?? undefined,
            }),
          ),
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
      outputSchema: projectOutputSchema,
    },
    async ({ project }: { project: string }) => {
      const p = await coreApi.getProject(project);
      return {
        content: [],
        structuredContent: normalizeAzureDevOpsDates({
          id: p.id ?? undefined,
          name: p.name ?? undefined,
          description: p.description ?? undefined,
          abbreviation: p.abbreviation ?? undefined,
          url: p.url ?? undefined,
          state: p.state ?? undefined,
          visibility: p.visibility ?? undefined,
          revision: p.revision ?? undefined,
          defaultTeamImageUrl: p.defaultTeamImageUrl ?? undefined,
          lastUpdateTime: p.lastUpdateTime ?? undefined,
          defaultTeam: p.defaultTeam ?? undefined,
        }),
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
      outputSchema: projectTeamOutputSchema,
    },
    async ({ project, teamId }: { project: string; teamId: string }) => {
      const team = await coreApi.getTeam(project, teamId);
      return {
        content: [],
        structuredContent: {
          id: team.id ?? undefined,
          name: team.name ?? undefined,
          description: team.description ?? undefined,
          url: team.url ?? undefined,
          identityUrl: team.identityUrl ?? undefined,
          projectId: team.projectId ?? undefined,
          projectName: team.projectName ?? undefined,
        },
      };
    },
  );
}
