import { loadConfig } from "@/config";
import { checkPrerequisites } from "@/prerequisites/prerequisites";
import { fail, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await checkPrerequisites(loadConfig()));
  } catch (error) {
    return fail(error);
  }
}
