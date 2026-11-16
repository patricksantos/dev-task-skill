import { checkPrerequisites } from "@/prerequisites/prerequisites";
import { fail, json } from "@/server/http";
import { getRunManager } from "@/server/singleton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await checkPrerequisites(getRunManager().config));
  } catch (error) {
    return fail(error);
  }
}
