import { ok, publicRoute } from "@/lib/api";
import { orderLookupSchema, orderService } from "@/services/orders";

export const runtime = "nodejs";

export const POST = publicRoute(async (ctx) => {
  const { order_number, phone } = await ctx.body(orderLookupSchema);
  return ok(await orderService.claimPaid(order_number, phone), "Terima kasih. Pembayaran Anda sedang kami periksa.");
});
