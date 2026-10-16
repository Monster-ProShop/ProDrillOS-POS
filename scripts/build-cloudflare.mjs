import { spawnSync } from "node:child_process";
const result = spawnSync("pnpm", ["exec", "opennextjs-cloudflare", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, PRISMA_RUNTIME: "cloudflare" },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
