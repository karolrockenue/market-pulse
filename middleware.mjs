import { NextResponse } from "next/server";

export function middleware(request) {
  // Get the session cookie. Vercel uses a default name, but you can check your browser's dev tools.
  const sessionCookie = request.cookies.get("connect.sid"); // The default name for express-session
  const { pathname } = request.nextUrl;

  // If the user is trying to access a protected page and has no session cookie...
  if (
    (pathname.startsWith("/app") || pathname.startsWith("/admin")) &&
    !sessionCookie
  ) {
    // ...redirect them to the sign-in page.
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  // Otherwise, continue as normal.
  return NextResponse.next();
}
// middleware.mjs

import { NextResponse } from "next/server";

export function middleware(request) {
  // --- DEBUG LOG ---
  console.log(
    `[Vercel Middleware] Running for path: ${request.nextUrl.pathname}`
  );

  const sessionCookie = request.cookies.get("connect.sid");
  const { pathname } = request.nextUrl;

  // --- DEBUG LOG ---
  console.log(`[Vercel Middleware] Found session cookie: ${!!sessionCookie}`);

  if (
    (pathname.startsWith("/app") || pathname.startsWith("/admin")) &&
    !sessionCookie
  ) {
    // --- DEBUG LOG ---
    console.log(
      `[Vercel Middleware] No session cookie found. Redirecting to /signin.`
    );

    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  // --- DEBUG LOG ---
  console.log(`[Vercel Middleware] Allowed request to continue.`);
  return NextResponse.next();
}
