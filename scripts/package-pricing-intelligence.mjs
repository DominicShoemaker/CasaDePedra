import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const serviceRoot = join(repositoryRoot, "services", "pricing-intelligence");
const outputRoot = join(repositoryRoot, ".deploy", "pricing-intelligence");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const file of ["host.json", "package.json", ".funcignore"]) {
  await cp(join(serviceRoot, file), join(outputRoot, file));
}
await cp(join(serviceRoot, "src"), join(outputRoot, "src"), { recursive: true });

console.log(`Prepared standalone pricing intelligence package at ${outputRoot}`);
