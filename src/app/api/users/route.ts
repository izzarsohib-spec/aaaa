import { created, ok, pageParams, paged, route } from "@/lib/api";
import { userCreateSchema } from "@/lib/validation";
import { userService } from "@/services";

export const runtime = "nodejs";

export const GET = route({ roles: ["ADMIN"] }, async (ctx) => {
  const p = pageParams(ctx.query, ["name"], "name");
  const { items, total } = await userService.list(p);
  return ok(paged(items, total, p.page, p.limit));
});

export const POST = route({ roles: ["ADMIN"] }, async (ctx) => {
  const user = await userService.create(await ctx.body(userCreateSchema));
  return created(user, "/api/users", "Akun berhasil dibuat");
});
