import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
function equal(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/stripe/webhook" || request.nextUrl.pathname === "/payment-return") return NextResponse.next();
  const user = process.env.POS_USERNAME, password = process.env.POS_PASSWORD;
  if (!user || !password || password === "replace-with-a-long-random-password") return new NextResponse("Set POS_USERNAME and a strong POS_PASSWORD in .env before using the POS.", { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  let credentials = "";
  if (authorization.startsWith("Basic ")) credentials = Buffer.from(authorization.slice(6), "base64").toString();
  if (!equal(credentials, `${user}:${password}`)) return new NextResponse("Staff sign-in required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="ProDrillOS POS", charset="UTF-8"' } });
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(process.env.APP_URL ?? request.url).origin) return new NextResponse("Invalid origin", { status: 403 });
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"] };
