import { readCatalog } from "@/catalog/catalog";
import { fail, json } from "@/server/http";
import { getRunManager } from "@/server/singleton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    return json(readCatalog(getRunManager().config.repoRoot));
  } catch (error) {
    return fail(error);
  }
}
