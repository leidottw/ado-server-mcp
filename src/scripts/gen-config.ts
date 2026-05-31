import fs from "fs";
import path from "path";
import os from "os";
import { spawnSync } from "child_process";

const projectRoot = path.resolve(process.cwd());
const envPath = path.join(projectRoot, ".env");
const homeDir = os.homedir();

function parseEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    console.error(`找不到 .env 檔案：${filePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const parts = line.split("=");
        const key = parts.shift();
        const value = parts.join("=");
        return [key?.trim() ?? "", value.trim()];
      })
      .filter(([key]) => key !== ""),
  );
}

function hasBun(): boolean {
  const result = spawnSync("bun", ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

function writeConfig(configPath: string, content: unknown): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
}

function showUsage(): void {
  console.error(
    "用法: bun run src/scripts/gen-config.ts [--workspace] [--help]",
  );
  console.error("  --workspace  建立或更新工作區層級的 .vscode/mcp.json");
  process.exit(0);
}

function validateArgs(args: string[]): void {
  const invalid = args.filter(
    (arg) =>
      arg !== "--workspace" && arg !== "--help" && !arg.startsWith("--scope="),
  );
  if (invalid.length > 0) {
    console.error(`不支援的參數: ${invalid.join(", ")}`);
    showUsage();
  }
  const scopeArg = args.find((arg) => arg.startsWith("--scope="));
  if (scopeArg) {
    const value = scopeArg.split("=")[1];
    if (value !== "workspace") {
      console.error(`不支援的 scope: ${value}。僅支援 workspace。`);
      showUsage();
    }
  }
}

function getTargetPath(): string {
  return path.join(projectRoot, ".vscode", "mcp.json");
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    showUsage();
  }
  validateArgs(args);
  const targetPath = getTargetPath();
  const env = parseEnv(envPath);
  const requiredKeys = ["AZURE_DEVOPS_URL", "AZURE_DEVOPS_TOKEN"];
  const missingKeys = requiredKeys.filter((key) => !env[key]);
  if (missingKeys.length > 0) {
    console.error(
      `缺少必要環境變數：${missingKeys.join(", ")}。請在 ${envPath} 中補上。`,
    );
    process.exit(1);
  }

  const apiVersion = env.AZURE_DEVOPS_API_VERSION || "7.1";
  const bunAvailable = hasBun();
  const command = bunAvailable ? "bun" : "node";
  const runnerArgs = bunAvailable
    ? ["run", path.join(projectRoot, "src/index.ts")]
    : [path.join(projectRoot, "dist/index.js")];

  if (
    !bunAvailable &&
    !fs.existsSync(path.join(projectRoot, "dist/index.js"))
  ) {
    console.error(
      "bun 未安裝，且 dist/index.js 不存在。請先執行 npm run build 或 bun build ./src/index.ts --outdir ./dist --target node。",
    );
    process.exit(1);
  }

  let existingConfig: Record<string, unknown> = {};
  if (fs.existsSync(targetPath)) {
    try {
      const raw = fs.readFileSync(targetPath, "utf8");
      existingConfig = JSON.parse(raw);
      if (
        typeof existingConfig !== "object" ||
        existingConfig === null ||
        Array.isArray(existingConfig)
      ) {
        existingConfig = {};
      }
    } catch (error) {
      console.error(
        `無法解析現有的 ${targetPath}，請先修正 JSON 格式。`,
        error,
      );
      process.exit(1);
    }
  }

  const existingServers =
    typeof existingConfig.servers === "object" &&
    existingConfig.servers !== null
      ? (existingConfig.servers as Record<string, unknown>)
      : typeof existingConfig.mcpServers === "object" &&
          existingConfig.mcpServers !== null
        ? (existingConfig.mcpServers as Record<string, unknown>)
        : {};

  const mergedConfig = {
    ...existingConfig,
    servers: {
      ...existingServers,
      "azure-devops-server-mcp": {
        type: "stdio",
        command,
        args: runnerArgs,
        env: {
          AZURE_DEVOPS_URL: env.AZURE_DEVOPS_URL,
          AZURE_DEVOPS_TOKEN: env.AZURE_DEVOPS_TOKEN,
          AZURE_DEVOPS_API_VERSION: apiVersion,
          ...(env.NODE_TLS_REJECT_UNAUTHORIZED
            ? { NODE_TLS_REJECT_UNAUTHORIZED: env.NODE_TLS_REJECT_UNAUTHORIZED }
            : {}),
        },
      },
    },
  };

  writeConfig(targetPath, mergedConfig);
  console.error(`已更新 VS Code workspace MCP 設定：${targetPath}`);
}

main();
