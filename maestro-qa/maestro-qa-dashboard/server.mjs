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
const idleMinutes = Number(process.env.DASHBOARD_IDLE_MINUTES ?? 30);
const idleMs = Number.isFinite(idleMinutes) && idleMinutes > 0 ? idleMinutes * 60_000 : 0;
let lastActivity = Date.now();
const app = next({ dev, hostname: host, port, dir: root });
const handle = app.getRequestHandler();

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

await app.prepare();

const server = createServer((request, response) => {
  if (!isLoopback(request.socket.remoteAddress)) {
    response.statusCode = 403;
    response.end("Dashboard disponível apenas em localhost.");
    return;
  }
  if (request.method === "POST" && request.url?.startsWith("/api/runs")) lastActivity = Date.now();
  handle(request, response, parse(request.url ?? "/", true));
}).listen(port, host, () => {
  console.log(`Maestro QA Dashboard em http://${host}:${port}`);
  if (idleMs) console.log(`Encerra sozinho após ${idleMinutes} min sem suíte em execução.`);
});

// ponytail: consulta a própria API a cada minuto; uma suíte em execução conta como atividade
if (idleMs) {
  setInterval(async () => {
    try {
      const response = await fetch(`http://${host}:${port}/api/runs`);
      const { runs } = await response.json();
      if (runs.some((run) => run.status === "running")) lastActivity = Date.now();
    } catch {
      return;
    }
    if (Date.now() - lastActivity < idleMs) return;
    console.log(`Nenhuma suíte executada em ${idleMinutes} min. Encerrando o dashboard.`);
    server.close();
    process.exit(0);
  }, Math.min(60_000, idleMs)).unref();
}
