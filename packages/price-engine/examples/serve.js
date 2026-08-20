import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const port = Number(process.env.PORT ?? 8765);
const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
]);

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    const relative = url.pathname === "/" ? "examples/browser.html" : url.pathname.slice(1);
    const path = resolve(root, relative);
    if (path !== root && !path.startsWith(`${root}${sep}`)) throw new Error("Path is outside the example root.");
    const data = await readFile(path);
    response.writeHead(200, {
      "Content-Type": contentTypes.get(extname(path)) ?? "application/octet-stream",
      "Content-Length": data.length,
      "Cache-Control": "no-store",
    });
    response.end(data);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Browser example: http://127.0.0.1:${port}/examples/browser.html`);
});
