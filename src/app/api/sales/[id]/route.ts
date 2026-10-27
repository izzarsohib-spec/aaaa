import { z } from "zod";
import { ok, route } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { saleService } from "@/services";

export const runtime = "nodejs";

export const GET = route({ roles: ["ADMIN", "STAFF"] }, async (ctx) => {
  const id = z.string().uuid().safeParse(ctx.params.id);
  if (!id.success) throw badRequest("ID transaksi tidak valid");
  return ok(await saleService.detail(id.data, ctx.session.role));
});
