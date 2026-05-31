import axios from "axios";
import type { AxiosInstance } from "axios";
import { z } from "zod";
import { Agent as HttpsAgent } from "https";

const envSource =
  typeof Bun !== "undefined" && typeof Bun.env !== "undefined"
    ? Bun.env
    : process.env;

const envSchema = z.object({
  AZURE_DEVOPS_URL: z.string().min(1),
  AZURE_DEVOPS_TOKEN: z.string().min(1),
  AZURE_DEVOPS_API_VERSION: z.string().default("7.1"),
  NODE_TLS_REJECT_UNAUTHORIZED: z.string().optional(),
});

const env = envSchema.parse({
  AZURE_DEVOPS_URL: envSource.AZURE_DEVOPS_URL,
  AZURE_DEVOPS_TOKEN: envSource.AZURE_DEVOPS_TOKEN,
  AZURE_DEVOPS_API_VERSION: envSource.AZURE_DEVOPS_API_VERSION,
  NODE_TLS_REJECT_UNAUTHORIZED: envSource.NODE_TLS_REJECT_UNAUTHORIZED,
});

const baseUrl = buildBaseUrl(env.AZURE_DEVOPS_URL);
const apiVersion = env.AZURE_DEVOPS_API_VERSION ?? "7.1";

if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export function getAzureDevOpsClient(): AxiosInstance {
  return axios.create({
    baseURL: `${baseUrl}/_apis`,
    headers: {
      Authorization: `Basic ${encodePat(env.AZURE_DEVOPS_TOKEN)}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    params: {
      "api-version": apiVersion,
    },
    httpsAgent: getHttpsAgent(),
    validateStatus: (status) => status >= 200 && status < 300,
  });
}

function buildBaseUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname.replace(/\/+$|^\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch (error) {
    console.error(
      "無效的 AZURE_DEVOPS_URL，請確認格式為 http(s)://server/collection",
      error,
    );
    throw error;
  }
}

function encodePat(token: string): string {
  const rawValue = `:${token}`;
  if (typeof btoa === "function") {
    return btoa(rawValue);
  }
  return Buffer.from(rawValue).toString("base64");
}

function getHttpsAgent(): HttpsAgent | undefined {
  const insecure = env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
  if (!insecure) {
    return undefined;
  }
  return new HttpsAgent({ rejectUnauthorized: false });
}
