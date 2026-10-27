import { ok, publicRoute } from "@/lib/api";
import { CSRF_COOKIE, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = publicRoute(async () => {
  const gone = { path: "/", maxAge: 0 };
  return ok(null, "Logout berhasil", {
    cookies: [
      { name: SESSION_COOKIE, value: "", options: gone },
      { name: CSRF_COOKIE, value: "", options: gone },
    ],
  });
});
