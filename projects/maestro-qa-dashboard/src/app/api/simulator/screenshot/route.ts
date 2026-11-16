import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { captureSimulatorScreenshot, checkPrerequisites } from "@/prerequisites/prerequisites";
import { json } from "@/server/http";
import { getRunManager } from "@/server/singleton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (getRunManager().busy) {
    return json(
      { error: "A captura fica desligada durante a execução para não interferir no Maestro." },
      409,
    );
  }
  const file = path.join(os.tmpdir(), `maestro-qa-${randomUUID()}.png`);
  try {
    const report = await checkPrerequisites(getRunManager().config);
    await captureSimulatorScreenshot(report.simulatorUdid, file);
    const bytes = fs.readFileSync(file);
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return json({ error: "Não foi possível capturar a tela do simulador." }, 503);
  } finally {
    fs.rmSync(file, { force: true });
  }
}
