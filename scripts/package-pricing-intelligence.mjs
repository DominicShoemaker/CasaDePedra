import { execFile } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const serviceRoot = join(repositoryRoot, "services", "pricing-intelligence");
const outputRoot = join(repositoryRoot, ".deploy", "pricing-intelligence");
const pnpmCli = process.env.npm_execpath;

if (!pnpmCli) throw new Error("Run this script through pnpm so npm_execpath is available.");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const file of ["host.json", "package.json", ".funcignore"]) {
  await cp(join(serviceRoot, file), join(outputRoot, file));
}
await cp(join(serviceRoot, "src"), join(outputRoot, "src"), { recursive: true });

await execFileAsync(process.execPath, [
  pnpmCli,
  "install",
  "--prod",
  "--ignore-workspace",
  "--config.node-linker=hoisted",
  "--config.package-import-method=copy",
], { cwd: outputRoot });

console.log(`Prepared standalone pricing intelligence package at ${outputRoot}`);
