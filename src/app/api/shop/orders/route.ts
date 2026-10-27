import { created, publicRoute } from "@/lib/api";
import { orderCreateSchema, orderService } from "@/services/orders";

export const runtime = "nodejs";

export const POST = publicRoute(async (ctx) => {
  const input = await ctx.body(orderCreateSchema);
  const order = await orderService.create(input);
  return created(order, "/pesanan", "Pesanan dibuat. Silakan lakukan pembayaran.");
});
