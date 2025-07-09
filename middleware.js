import { NextResponse } from "next/server";

// This function will run on requests to the paths specified in the matcher.
export function middleware(request) {
  // Check if the user has a session cookie. 'connect.sid' is the default name for express-session.
  const hasSession = request.cookies.has("connect.sid");

  // If the user has no session, and they are trying to access a protected page, redirect them to the login page.
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If they have a session, allow the request to continue.
  return NextResponse.next();
}

// This configures the middleware to ONLY run on page routes inside /app/ and /admin/
export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
