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

// ponytail: compara pelo nome, porque o RunManager global pode ter sido criado pelo bundle de outra rota, com outra cópia da classe RequestError
function isRequestError(error: unknown): error is RequestError {
  return error instanceof Error && error.name === "RequestError" && Number.isInteger((error as RequestError).status);
}

export function fail(error: unknown): NextResponse {
  if (isRequestError(error)) return json({ error: error.message }, error.status);
  console.error(error);
  return json({ error: "Falha interna do dashboard." }, 500);
}
