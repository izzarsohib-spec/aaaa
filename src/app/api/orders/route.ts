import { ok, pageParams, paged, route } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/shop";
import { orderService } from "@/services/orders";

export const runtime = "nodejs";

export const GET = route({ roles: ["ADMIN", "STAFF"] }, async (ctx) => {
  const p = pageParams(ctx.query, ["created_at"], "created_at");
  const status = ctx.query.get("status") ?? undefined;
  if (status && !(status in ORDER_STATUS_LABEL)) throw badRequest("Status tidak valid");
  const { items, total } = await orderService.list({ limit: p.limit, offset: p.offset, status: status as OrderStatus | undefined });
  return ok(paged(items, total, p.page, p.limit));
});
