import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = ["/", "/login", "/api/auth", "/share", "/register", "/guest", "/u/"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const logRequest =
    process.env.GARAGE_REQUEST_LOGS === "1"
      ? (outcome: string) => {
          console.log("[request]", {
            method: req.method,
            path: pathname,
            outcome,
          });
        }
      : () => {};

  if (PUBLIC.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)))) {
    logRequest("public");
    return NextResponse.next();
  }

  const token = req.cookies.get("garage_session")?.value;

  if (!token) {
    logRequest("redirect:login:no-session");
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
    await jwtVerify(token, secret);
    logRequest("authorized");
    return NextResponse.next();
  } catch {
    logRequest("redirect:login:invalid-session");
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("garage_session");
    return res;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|apple-touch-icon).*)",
  ],
};
