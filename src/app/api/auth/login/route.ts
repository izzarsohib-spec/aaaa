import { ok, publicRoute } from "@/lib/api";
import { CSRF_COOKIE, SESSION_COOKIE, csrfCookieOptions, sessionCookieOptions, signSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { authService } from "@/services";

export const runtime = "nodejs";

export const POST = publicRoute(async (ctx) => {
  const { email, password } = await ctx.body(loginSchema);
  const user = await authService.login(email, password, ctx.ip);
  const { token, csrf } = await signSession({ userId: user.id, role: user.role, name: user.name });
  return ok({ user: { id: user.id, name: user.name, role: user.role } }, "Login berhasil", {
    cookies: [
      { name: SESSION_COOKIE, value: token, options: sessionCookieOptions() },
      { name: CSRF_COOKIE, value: csrf, options: csrfCookieOptions() },
    ],
  });
});
