import { NextResponse } from "next/server";
import { RequestError } from "@/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof RequestError) return json({ error: error.message }, error.status);
  console.error(error);
  return json({ error: "Falha interna do dashboard." }, 500);
}
