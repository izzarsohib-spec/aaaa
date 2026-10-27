import { z } from "zod";
import { ok, publicRoute } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { shopService } from "@/services/orders";

export const runtime = "nodejs";

export const GET = publicRoute(async (ctx) => {
  const id = z.string().uuid().safeParse(ctx.params.id);
  if (!id.success) throw badRequest("ID produk tidak valid");
  return ok(await shopService.getProduct(id.data));
});
