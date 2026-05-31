import type { AxiosInstance } from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import * as z from "zod";

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
          z.object({
            id: z.string().nullable(),
            name: z.string().nullable(),
            description: z.string().nullable(),
            state: z.string().nullable(),
            url: z.string().nullable(),
          }),
        ),
      }),
    },
    async () => {
      const response = await client.get("projects");
      return {
        content: [],
        structuredContent: {
          projects: (response.data?.value ?? []).map((project: any) => ({
            id: project.id,
            name: project.name,
            description: project.description,
            state: project.state,
            url: project.url,
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
          z.object({
            id: z.string().nullable(),
            name: z.string().nullable(),
            description: z.string().nullable(),
            url: z.string().nullable(),
          }),
        ),
      }),
    },
    async ({ project }: { project: string }) => {
      const response = await client.get(
        `projects/${encodeURIComponent(project)}/teams`,
      );
      return {
        content: [],
        structuredContent: {
          project,
          teams: (response.data?.value ?? []).map((team: any) => ({
            id: team.id,
            name: team.name,
            description: team.description,
            url: team.url,
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
          z.object({
            id: z.string().nullable(),
            displayName: z.string().nullable(),
            uniqueName: z.string().nullable(),
            url: z.string().nullable(),
          }),
        ),
      }),
    },
    async ({ project, teamId }: { project: string; teamId: string }) => {
      const response = await client.get(
        `projects/${encodeURIComponent(project)}/teams/${encodeURIComponent(teamId)}/members`,
      );
      return {
        content: [],
        structuredContent: {
          project,
          teamId,
          members: (response.data?.value ?? []).map((member: any) => ({
            id: member.id,
            displayName: member.identity?.displayName ?? member.displayName,
            uniqueName: member.identity?.uniqueName ?? member.uniqueName,
            url: member.url,
          })),
        },
      };
    },
  );
}
