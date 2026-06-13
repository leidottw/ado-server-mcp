import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const OUTPUT_DIR =
  process.env["ADO_MCP_OUTPUT_DIR"] ?? path.join(os.tmpdir(), "ado-mcp");
const INLINE_LIMIT = parseInt(
  process.env["ADO_MCP_INLINE_LIMIT"] ?? "20000",
  10,
);
const FILE_HANDOFF_ENABLED =
  (process.env["ADO_MCP_FILE_HANDOFF"] ?? "on") !== "off";

export interface FileHandoffResult {
  savedToFile: true;
  path: string;
  bytes: number;
  lines: number;
  encoding: "utf-8";
  preview: string;
  hint: string;
}

const HINT =
  "完整內容已寫入上述 path。請用你的檔案工具（Read/Grep）按需讀取，避免一次讀入全部；可先 grep 關鍵字再讀上下文。";

let cleanupDone = false;

function ensureDir(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function cleanup(): void {
  if (cleanupDone) return;
  cleanupDone = true;
  try {
    if (!fs.existsSync(OUTPUT_DIR)) return;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const entry of fs.readdirSync(OUTPUT_DIR)) {
      const full = path.join(OUTPUT_DIR, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
      } catch {
        // best-effort
      }
    }
  } catch (e) {
    console.error("[ado-mcp] fileHandoff cleanup failed:", e);
  }
}

function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
}

function buildPreview(content: string): string {
  const lines = content.split("\n");
  const head = lines.slice(0, 30).join("\n");
  if (lines.length <= 40) return head;
  const tail = lines.slice(-10).join("\n");
  const preview = head + "\n...\n" + tail;
  return preview.length > 2000 ? preview.slice(0, 2000) : preview;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function timestamp(): string {
  const d = new Date();
  return (
    d.getFullYear().toString() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds())
  );
}

function randomSuffix(): string {
  return Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, "0");
}

export async function deliver(
  content: string,
  opts: {
    output: "inline" | "file" | "auto";
    toolName: string;
    key: string;
    ext: string;
  },
): Promise<{ text: string } | FileHandoffResult> {
  const shouldFile =
    FILE_HANDOFF_ENABLED &&
    (opts.output === "file" ||
      (opts.output === "auto" && content.length > INLINE_LIMIT));

  if (!shouldFile) {
    return { text: content };
  }

  ensureDir();
  cleanup();

  const fileName = `${sanitizeKey(opts.toolName)}-${sanitizeKey(opts.key)}-${timestamp()}-${randomSuffix()}.${opts.ext}`;
  const filePath = path.resolve(OUTPUT_DIR, fileName);

  // Safety: ensure the resolved path stays within OUTPUT_DIR
  if (!filePath.startsWith(path.resolve(OUTPUT_DIR) + path.sep)) {
    throw new Error("fileHandoff: path traversal detected");
  }

  fs.writeFileSync(filePath, content, "utf-8");

  return {
    savedToFile: true,
    path: filePath,
    bytes: Buffer.byteLength(content, "utf-8"),
    lines: content.split("\n").length,
    encoding: "utf-8",
    preview: buildPreview(content),
    hint: HINT,
  };
}
