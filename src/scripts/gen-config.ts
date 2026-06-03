import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..", "..");
const executionRoot = process.cwd();

function writeConfig(configPath: string, content: unknown): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
}

function showUsage(): void {
  console.error("用法: bun run src/scripts/gen-config.ts [--help]");
  console.error("       npx . gen-config [--help]");
  process.exit(0);
}

function validateArgs(args: string[]): void {
  const invalid = args.filter((arg) => arg !== "--help");
  if (invalid.length > 0) {
    console.error(`不支援的參數: ${invalid.join(", ")}`);
    showUsage();
  }
}

function getTargetPath(): string {
  return path.join(executionRoot, ".vscode", "mcp.json");
}

function main(): void {
  const rawArgs = process.argv.slice(2);
  const isPackageBinary = fileURLToPath(import.meta.url).endsWith(
    path.join("dist", "scripts", "gen-config.js"),
  );

  let args = rawArgs;
  if (isPackageBinary) {
    if (args.length === 0) {
      showUsage();
    }
    if (args[0] !== "gen-config") {
      console.error(`不支援的指令：${args[0]}`);
      showUsage();
    }
    args = args.slice(1);
  }

  if (args.includes("--help")) {
    showUsage();
  }
  validateArgs(args);

  const targetPath = getTargetPath();
  const command = "node";
  const distEntry = path.join(packageRoot, "dist", "index.js");
  const runnerArgs = [distEntry];

  if (!fs.existsSync(distEntry)) {
    console.error(
      "dist/index.js 不存在，請先執行 bun run build 以產生 build 檔案。",
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

  const existingInputsArray =
    Array.isArray(existingConfig.inputs) &&
    existingConfig.inputs.every((item) => typeof item === "object")
      ? (existingConfig.inputs as Array<Record<string, unknown>>)
      : [];

  const existingInputsById = new Map<string, Record<string, unknown>>();
  for (const input of existingInputsArray) {
    if (input && typeof input.id === "string") {
      existingInputsById.set(input.id, input);
    }
  }

  const baseInputs = [
    {
      id: "azureDevOpsUrl",
      type: "promptString",
      description:
        "Azure DevOps Server URL，例如 https://my-server/DefaultCollection",
      default: "",
    },
    {
      id: "azureDevOpsToken",
      type: "promptString",
      description: "Azure DevOps Personal Access Token",
      default: "",
    },
    {
      id: "nodeTlsRejectUnauthorized",
      type: "promptString",
      description: "若使用自簽章 HTTPS，輸入 0；留空則使用預設憑證驗證。",
      default: "",
    },
  ];

  const mergedInputs = [
    ...baseInputs.map((input) => ({
      ...input,
      default: existingInputsById.get(input.id)?.default ?? input.default ?? "",
    })),
    ...existingInputsArray.filter(
      (input) =>
        input &&
        typeof input.id === "string" &&
        !baseInputs.some((base) => base.id === input.id),
    ),
  ];

  const mergedConfig = {
    ...existingConfig,
    inputs: mergedInputs,
    servers: {
      ...existingServers,
      "azure-devops-server-mcp": {
        type: "stdio",
        command,
        args: runnerArgs,
        env: {
          AZURE_DEVOPS_URL: "${input:azureDevOpsUrl}",
          AZURE_DEVOPS_TOKEN: "${input:azureDevOpsToken}",
          NODE_TLS_REJECT_UNAUTHORIZED: "${input:nodeTlsRejectUnauthorized}",
        },
      },
    },
  };

  writeConfig(targetPath, mergedConfig);
  console.error(`已更新 VS Code workspace MCP 設定：${targetPath}`);
}

main();
