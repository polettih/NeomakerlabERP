import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Runs on every request (see matcher below). Keeps the Supabase auth session
// cookie refreshed and enforces the login/redirect rules in
// lib/supabase/proxy.ts. Previously this logic lived in a root-level
// `proxy.ts` file that Next.js never executed, because middleware must be a
// file literally named `middleware.ts` at the project root — so sessions
// were never refreshed proactively and could expire unexpectedly.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static files, images and the PWA manifest/service worker so the
    // middleware only runs for actual pages/API routes.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
