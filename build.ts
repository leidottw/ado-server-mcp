import process from "process";
import os from "os";

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "node",
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

if (!result.success) {
  console.error("Build failed");
  process.exit(1);
}

const outFile = "./dist/index.js";
const content = await Bun.file(outFile).text();
const cleaned = content.replaceAll(os.homedir(), "~");
await Bun.write(outFile, cleaned);

console.log("Build succeeded!");
