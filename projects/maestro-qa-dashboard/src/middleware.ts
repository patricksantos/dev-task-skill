import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    return new NextResponse("Dashboard disponível apenas em localhost.", { status: 403 });
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first !== "127.0.0.1" && first !== "::1") {
      return new NextResponse("Dashboard disponível apenas em localhost.", { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
