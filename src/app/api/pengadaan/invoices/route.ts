import { ok, pageParams, paged, route } from "@/lib/api";
import { pengadaanService } from "@/services/pengadaan";

export const runtime = "nodejs";

const STATUSES = ["MENDATANG", "LUNAS", "DIBATALKAN"] as const;

export const GET = route({ roles: ["ADMIN"] }, async (ctx) => {
  const p = pageParams(ctx.query, ["due_date"], "due_date");
  const raw = ctx.query.get("status");
  const status = STATUSES.find((s) => s === raw);
  const { items, total } = await pengadaanService.listInvoices({ limit: p.limit, offset: p.offset, status });
  return ok(paged(items, total, p.page, p.limit));
});
