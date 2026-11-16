import { fail, json } from "@/server/http";
import { pickLocalDirectory } from "@/projects/browse-directory";

export const maxDuration = 180;

export async function POST() {
  try {
    const path = await pickLocalDirectory();
    return json({ path, cancelled: path == null });
  } catch (error) {
    return fail(error);
  }
}
