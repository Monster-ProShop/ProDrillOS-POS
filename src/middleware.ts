import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/access";
export async function middleware(request: NextRequest) {
  return (await authorize(request)) ?? NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
