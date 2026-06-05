import process from "process";

// build.ts
const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "node",
});

if (!result.success) {
  console.error("Build failed");
  process.exit(1);
} else {
  console.log("Build succeeded!");
}
