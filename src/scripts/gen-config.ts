import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const projectRoot = path.resolve(process.cwd());

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
    (arg) => arg !== "--workspace" && arg !== "--help",
  );
  if (invalid.length > 0) {
    console.error(`不支援的參數: ${invalid.join(", ")}`);
    showUsage();
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
  const apiVersion = "7.1";
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
      id: "azureDevOpsApiVersion",
      type: "promptString",
      description: "Azure DevOps API 版本",
      default: apiVersion,
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
          AZURE_DEVOPS_API_VERSION: "${input:azureDevOpsApiVersion}",
          NODE_TLS_REJECT_UNAUTHORIZED: "${input:nodeTlsRejectUnauthorized}",
        },
      },
    },
  };

  writeConfig(targetPath, mergedConfig);
  console.error(`已更新 VS Code workspace MCP 設定：${targetPath}`);
}

main();
