import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { readdirSync } from "node:fs";

const execFileAsync = promisify(execFile);
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const serviceRoot = join(repositoryRoot, "services", "pricing-api");
const outputRoot = join(repositoryRoot, ".deploy", "pricing-api");
const pnpmCli = process.env.npm_execpath;

if (!pnpmCli) throw new Error("Run this script through pnpm so npm_execpath is available.");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const file of ["host.json", "package.json", ".funcignore"]) {
  await cp(join(serviceRoot, file), join(outputRoot, file));
}
await cp(join(serviceRoot, "src"), join(outputRoot, "src"), { recursive: true });
await cp(join(serviceRoot, "examples"), join(outputRoot, "examples"), { recursive: true });
await cp(
  join(repositoryRoot, "config", "pricing", "casa-de-pedra.yaml"),
  join(outputRoot, "examples", "casa-de-pedra.yaml"),
);

await execFileAsync(process.execPath, [
  pnpmCli,
  "--filter",
  "@pmc/price-engine",
  "pack",
  "--pack-destination",
  outputRoot,
], { cwd: repositoryRoot });

// Find the generated tarball dynamically
const tarballs = readdirSync(outputRoot).filter(f => f.endsWith('.tgz'));
if (tarballs.length === 0) {
  throw new Error("No .tgz file found in output directory after pnpm pack");
}
if (tarballs.length > 1) {
  throw new Error(`Multiple .tgz files found: ${tarballs.join(', ')}`);
}
const tarballName = tarballs[0];

const packagePath = join(outputRoot, "package.json");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.main = "src/functions/*.js";
packageJson.dependencies["@pmc/price-engine"] = `file:./${tarballName}`;
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

await execFileAsync(process.execPath, [
  pnpmCli,
  "install",
  "--prod",
  "--ignore-workspace",
  "--config.node-linker=hoisted",
  "--config.package-import-method=copy",
], { cwd: outputRoot });

console.log(`Prepared standalone pricing API package at ${outputRoot}`);
