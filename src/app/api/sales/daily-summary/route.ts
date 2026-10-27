import { ok, route } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { saleService } from "@/services";

export const runtime = "nodejs";

export const GET = route({ roles: ["ADMIN", "STAFF"] }, async (ctx) => {
  const date = ctx.query.get("date") ?? undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("Format date harus YYYY-MM-DD");
  return ok(await saleService.dailySummary(ctx.session.role, date));
});
