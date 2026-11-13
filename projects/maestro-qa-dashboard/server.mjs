import { createServer } from "node:http";
import path from "node:path";
import { parse } from "node:url";
import { fileURLToPath } from "node:url";
import next from "next";

const root = path.dirname(fileURLToPath(import.meta.url));
process.chdir(root);

const host = "127.0.0.1";
const requested = Number(process.env.DASHBOARD_PORT ?? 4310);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 4310;
const dev = process.argv.includes("--dev");
const app = next({ dev, hostname: host, port, dir: root });
const handle = app.getRequestHandler();

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

await app.prepare();

createServer((request, response) => {
  if (!isLoopback(request.socket.remoteAddress)) {
    response.statusCode = 403;
    response.end("Dashboard disponível apenas em localhost.");
    return;
  }
  handle(request, response, parse(request.url ?? "/", true));
}).listen(port, host, () => {
  console.log(`Maestro QA Dashboard em http://${host}:${port}`);
});
