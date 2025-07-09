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
