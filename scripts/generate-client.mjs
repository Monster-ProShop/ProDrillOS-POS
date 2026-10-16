import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cloudflare = process.env.PRISMA_RUNTIME === "cloudflare";
const temporarySchema = "prisma/.cloudflare.prisma";
try {
  if (cloudflare) {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    writeFileSync(temporarySchema, schema.replace("generator client {", 'generator client {\n  runtime = "cloudflare"'));
  }
  execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "generate", "--schema", cloudflare ? temporarySchema : "prisma/schema.prisma"], { stdio: "inherit" });
} finally {
  if (cloudflare) unlinkSync(temporarySchema);
}
