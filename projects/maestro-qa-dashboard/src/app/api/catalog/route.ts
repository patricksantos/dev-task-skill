import { loadConfig } from "@/config";
import { readCatalog } from "@/catalog/catalog";
import { fail, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    return json(readCatalog(loadConfig().repoRoot));
  } catch (error) {
    return fail(error);
  }
}
