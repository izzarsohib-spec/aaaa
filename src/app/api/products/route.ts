import { created, ok, pageParams, paged, route } from "@/lib/api";
import { productCreateSchema } from "@/lib/validation";
import { PRODUCT_SORTABLE } from "@/repositories";
import { productService } from "@/services";

export const runtime = "nodejs";

export const GET = route({ roles: ["ADMIN", "STAFF"] }, async (ctx) => {
  const p = pageParams(ctx.query, PRODUCT_SORTABLE, "name");
  const { items, total } = await productService.list(ctx.session.role, p);
  return ok(paged(items, total, p.page, p.limit));
});

export const POST = route({ roles: ["ADMIN"] }, async (ctx) => {
  const input = await ctx.body(productCreateSchema);
  const product = await productService.create(input, ctx.session.role);
  return created(product, "/api/products/" + product.id, "Produk berhasil dibuat");
});
