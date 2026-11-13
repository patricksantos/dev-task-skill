import { json } from "@/server/http";
import { getRunManager } from "@/server/singleton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const xml = getRunManager().reportXml(id);
  if (!xml) return json({ error: "Relatório JUnit não disponível para esta execução." }, 404);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${id}.xml"`,
    },
  });
}
