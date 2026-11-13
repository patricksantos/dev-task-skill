import { json } from "@/server/http";
import { getRunManager } from "@/server/singleton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const details = getRunManager().details(id);
  if (!details) return json({ error: "Execução não encontrada." }, 404);
  return json(details);
}
