import { fail, json } from "@/server/http";
import { getRunManager } from "@/server/singleton";
import { RequestError } from "@/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const registry = getRunManager().registry;
    if (!registry) throw new RequestError(500, "Falha interna do dashboard.");
    return json({ discovery: registry.discover(id) });
  } catch (error) {
    return fail(error);
  }
}
