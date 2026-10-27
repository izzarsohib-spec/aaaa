import { ok, pageParams, paged, publicRoute } from "@/lib/api";
import { SHOP_SORTS } from "@/repositories/orders";
import { shopService } from "@/services/orders";

export const runtime = "nodejs";

export const GET = publicRoute(async (ctx) => {
  const p = pageParams(ctx.query, SHOP_SORTS, "newest");
  const category = ctx.query.get("category") ?? undefined;
  const { items, total } = await shopService.listProducts({
    limit: p.limit,
    offset: p.offset,
    search: p.search,
    category,
    sort: p.sortBy,
    inStockOnly: ctx.query.get("in_stock") === "1",
  });
  return ok(paged(items, total, p.page, p.limit));
});
