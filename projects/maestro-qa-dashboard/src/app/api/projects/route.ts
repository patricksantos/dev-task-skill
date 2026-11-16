import { fail, json } from "@/server/http";
import { getRunManager } from "@/server/singleton";
import { RequestError } from "@/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    const manager = getRunManager();
    const registry = manager.registry;
    if (!registry) throw new RequestError(500, "Falha interna do dashboard.");
    registry.syncFromConfig(manager.config);
    manager.applyWorkspaceConfig();
    const workspace = registry.workspace();
    let discovery = null;
    if (workspace.activeProject) {
      try {
        discovery = registry.discover(workspace.activeProject.id);
      } catch {
        discovery = null;
      }
    }
    return json({
      ...workspace,
      discovery,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 4000) return json({ error: "Pedido recusado." }, 400);
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Pedido recusado." }, 400);
    const allowed = new Set(["name", "description", "type", "repositoryPath"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return json({ error: "Pedido recusado." }, 400);
    const manager = getRunManager();
    const registry = manager.registry;
    if (!registry) throw new RequestError(500, "Falha interna do dashboard.");
    const project = registry.createProject(body);
    return json({ project, workspace: registry.workspace() }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Pedido recusado." }, 400);
    return fail(error);
  }
}
