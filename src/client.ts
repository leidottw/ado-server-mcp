import { getPersonalAccessTokenHandler, WebApi } from "azure-devops-node-api";
import type { IBuildApi } from "azure-devops-node-api/BuildApi";
import type { IWorkApi } from "azure-devops-node-api/WorkApi";
import type { IWikiApi } from "azure-devops-node-api/WikiApi";
import { z } from "zod";

const envSource =
  typeof Bun !== "undefined" && typeof Bun.env !== "undefined"
    ? Bun.env
    : process.env;

const envSchema = z.object({
  AZURE_DEVOPS_URL: z.string().min(1),
  AZURE_DEVOPS_TOKEN: z.string().min(1),
  NODE_TLS_REJECT_UNAUTHORIZED: z.string().optional(),
});

const env = envSchema.parse({
  AZURE_DEVOPS_URL: envSource.AZURE_DEVOPS_URL,
  AZURE_DEVOPS_TOKEN: envSource.AZURE_DEVOPS_TOKEN,
  NODE_TLS_REJECT_UNAUTHORIZED: envSource.NODE_TLS_REJECT_UNAUTHORIZED,
});

const baseUrl = buildBaseUrl(env.AZURE_DEVOPS_URL);

if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  console.warn(
    "NODE_TLS_REJECT_UNAUTHORIZED=0 已啟用不安全 HTTPS 驗證，僅建議用於測試或內部環境。",
  );
}

export interface AzureDevOpsClient {
  core: any;
  git: any;
  wit: any;
  build: IBuildApi;
  work: IWorkApi;
  wiki: IWikiApi;
}

export async function getAzureDevOpsClient(): Promise<AzureDevOpsClient> {
  const authHandler = getPersonalAccessTokenHandler(env.AZURE_DEVOPS_TOKEN);
  const connection = new WebApi(baseUrl, authHandler);
  const [core, git, wit, build, work, wiki] = await Promise.all([
    connection.getCoreApi(),
    connection.getGitApi(),
    connection.getWorkItemTrackingApi(),
    connection.getBuildApi(),
    connection.getWorkApi(),
    connection.getWikiApi(),
  ]);
  return { core, git, wit, build, work, wiki };
}

function buildBaseUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname.replace(/\/+$/g, "");
    return pathname && pathname !== "/"
      ? `${parsed.origin}${pathname}`
      : parsed.origin;
  } catch (error) {
    console.error(
      "無效的 AZURE_DEVOPS_URL，請確認格式為 http(s)://server/collection",
      error,
    );
    throw error;
  }
}
