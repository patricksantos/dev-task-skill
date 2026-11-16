import { fail, json } from "@/server/http";
import { getRunManager } from "@/server/singleton";
import { RequestError } from "@/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const text = await request.text();
    if (text.length > 4000) return json({ error: "Pedido recusado." }, 400);
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Pedido recusado." }, 400);
    const allowed = new Set(["name", "description", "type", "enabled"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return json({ error: "Pedido recusado." }, 400);
    const registry = getRunManager().registry;
    if (!registry) throw new RequestError(500, "Falha interna do dashboard.");
    const project = registry.updateProject(id, body);
    return json({ project, workspace: registry.workspace() });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Pedido recusado." }, 400);
    return fail(error);
  }
}
