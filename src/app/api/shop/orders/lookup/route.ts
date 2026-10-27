import { ok, publicRoute } from "@/lib/api";
import { orderLookupSchema, orderService } from "@/services/orders";

export const runtime = "nodejs";

/** POST (bukan GET) supaya nomor HP tidak masuk URL/log. */
export const POST = publicRoute(async (ctx) => {
  const { order_number, phone } = await ctx.body(orderLookupSchema);
  return ok(await orderService.lookup(order_number, phone));
});
