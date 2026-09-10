import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET_KEY = process.env.SESSION_SECRET || "default_fallback_session_secret_change_in_production_32_bytes";
const encodedKey = new TextEncoder().encode(SECRET_KEY);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = pathname === "/login";

  const sessionToken = request.cookies.get("session")?.value;
  let isAuthenticated = false;

  if (sessionToken) {
    try {
      const { payload } = await jwtVerify(sessionToken, encodedKey, {
        algorithms: ["HS256"],
      });
      if (payload.userId === "user1" || payload.userId === "user2") {
        isAuthenticated = true;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  // Redirect to /login if trying to access protected route without auth
  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect to / if already authenticated and trying to access /login
  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
