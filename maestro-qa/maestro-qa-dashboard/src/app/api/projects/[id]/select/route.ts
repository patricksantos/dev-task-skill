import { fail, json } from "@/server/http";
import { getRunManager } from "@/server/singleton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const text = await request.text();
    if (text.length > 1000) return json({ error: "Pedido recusado." }, 400);
    const body = text ? (JSON.parse(text) as { environmentId?: unknown }) : {};
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const keys = Object.keys(body);
      if (keys.some((key) => key !== "environmentId")) return json({ error: "Pedido recusado." }, 400);
    }
    const workspace = getRunManager().selectProject(id, typeof body.environmentId === "string" ? body.environmentId : null);
    return json({ workspace });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Pedido recusado." }, 400);
    return fail(error);
  }
}
