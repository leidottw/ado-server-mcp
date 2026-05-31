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
      outputSchema: z.object({
        projects: z.array(
          projectOutputSchemaByVersion[apiVersion as SupportedApiVersion],
        ),
      }),
    },
    async () => {
      const response = await client.get("projects");
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
      },
      outputSchema: z.object({
        project: z.string(),
        teams: z.array(
          projectTeamOutputSchemaByVersion[apiVersion as SupportedApiVersion],
        ),
      }),
    },
    async ({ project }: { project: string }) => {
      const response = await client.get(
        `projects/${encodeURIComponent(project)}/teams`,
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
    async ({ project, teamId }: { project: string; teamId: string }) => {
      const response = await client.get(
        `projects/${encodeURIComponent(project)}/teams/${encodeURIComponent(teamId)}/members`,
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
          })),
        },
      };
    },
  );
}
