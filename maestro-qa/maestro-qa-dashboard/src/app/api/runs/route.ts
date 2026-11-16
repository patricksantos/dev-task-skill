import { fail, json } from "@/server/http";
import { getRunManager } from "@/server/singleton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return json({ runs: getRunManager().listRuns(40) });
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 2000) return json({ error: "Pedido recusado." }, 400);
    const body = text ? (JSON.parse(text) as { suite?: unknown; mode?: unknown }) : {};
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Pedido recusado." }, 400);
    const keys = Object.keys(body);
    if (keys.some((key) => key !== "suite" && key !== "mode")) return json({ error: "Pedido recusado." }, 400);
    const run = await getRunManager().start({
      suite: typeof body.suite === "string" ? body.suite : undefined,
      mode: typeof body.mode === "string" ? body.mode : undefined,
    });
    return json({ run }, 202);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Pedido recusado." }, 400);
    return fail(error);
  }
}
