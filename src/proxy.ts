import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

// Rutas que no requieren sesión.
const PUBLIC_PATHS = ["/login", "/registro", "/recuperar", "/api/inbound-email", "/api/cron", "/acceso", "/api/marketing"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const userId = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo-acf.svg|logo-acf-pdf.png|robots.txt|sw.js|manifest.webmanifest|icon-192.png|icon-512.png|apple-touch-icon.png|badge-96.png).*)"],
};
