import { fail, json } from "@/server/http";
import { getRunManager } from "@/server/singleton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    getRunManager().stop(id);
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
