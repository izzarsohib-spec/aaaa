import { created, ok, pageParams, paged, route } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { dateRangeSchema, saleCreateSchema } from "@/lib/validation";
import { saleService } from "@/services";

export const runtime = "nodejs";

export const GET = route({ roles: ["ADMIN", "STAFF"] }, async (ctx) => {
  const p = pageParams(ctx.query, ["created_at"], "created_at");
  const range = dateRangeSchema.safeParse({
    from: ctx.query.get("from") ?? undefined,
    to: ctx.query.get("to") ?? undefined,
  });
  if (!range.success) throw badRequest("Rentang tanggal tidak valid");
  const { items, total } = await saleService.list(ctx.session.role, {
    limit: p.limit,
    offset: p.offset,
    ...range.data,
  });
  return ok(paged(items, total, p.page, p.limit));
});

export const POST = route({ roles: ["ADMIN", "STAFF"] }, async (ctx) => {
  const input = await ctx.body(saleCreateSchema);
  const sale = await saleService.create(input, ctx.session.userId);
  return created(sale, "/api/sales/" + sale.id, "Transaksi berhasil disimpan");
});
