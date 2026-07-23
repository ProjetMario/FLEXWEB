import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const host = req.headers.get("host") ?? "";
  const pathname = nextUrl.pathname;

  // Skip middleware for auth API routes and static files
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const isDashboard = !rootDomain || host === rootDomain || host === `www.${rootDomain}`;

  if (isDashboard) {
    // Dashboard routes require authentication
    const isAuthRoute =
      pathname.startsWith("/login") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/forgot-password");

    if (!req.auth && !isAuthRoute) {
      const loginUrl = new URL("/login", nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
    }

    return NextResponse.next();
  }

  // Public site: add tenant headers for server components
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-forwarded-host", host);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|assets).*)"],
};
