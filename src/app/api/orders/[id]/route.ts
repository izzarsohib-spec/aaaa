import { z } from "zod";
import { ok, route } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { orderActionSchema, orderService } from "@/services/orders";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

export const GET = route({ roles: ["ADMIN", "STAFF"] }, async (ctx) => {
  const id = idSchema.safeParse(ctx.params.id);
  if (!id.success) throw badRequest("ID pesanan tidak valid");
  return ok(await orderService.detail(id.data));
});

export const PATCH = route({ roles: ["ADMIN", "STAFF"] }, async (ctx) => {
  const id = idSchema.safeParse(ctx.params.id);
  if (!id.success) throw badRequest("ID pesanan tidak valid");
  const input = await ctx.body(orderActionSchema);
  return ok(await orderService.act(id.data, input, ctx.session.userId, ctx.session.role === "ADMIN"), "Pesanan diperbarui");
});
