import { ok, pageParams, paged, route } from "@/lib/api";
import { pengadaanService } from "@/services/pengadaan";

export const runtime = "nodejs";

export const GET = route({ roles: ["ADMIN"] }, async (ctx) => {
  const p = pageParams(ctx.query, ["created_at"], "created_at");
  const { items, total } = await pengadaanService.listReceipts({ limit: p.limit, offset: p.offset });
  return ok(paged(items, total, p.page, p.limit));
});
