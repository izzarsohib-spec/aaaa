import { created, ok, pageParams, paged, route } from "@/lib/api";
import { stockAdjustmentSchema } from "@/lib/validation";
import { stockService } from "@/services";

export const runtime = "nodejs";

export const GET = route({ roles: ["ADMIN", "STAFF"] }, async (ctx) => {
  const p = pageParams(ctx.query, ["created_at"], "created_at");
  const productId = ctx.query.get("product_id") ?? undefined;
  const { items, total } = await stockService.list({ limit: p.limit, offset: p.offset, productId });
  return ok(paged(items, total, p.page, p.limit));
});

export const POST = route({ roles: ["ADMIN", "STAFF"] }, async (ctx) => {
  const input = await ctx.body(stockAdjustmentSchema);
  const row = await stockService.adjust(input, ctx.session.userId);
  return created(row, "/api/stock-adjustments", "Penyesuaian stok tercatat");
});
