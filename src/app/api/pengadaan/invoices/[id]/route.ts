import { z } from "zod";
import { ok, route } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { invoiceActionSchema } from "@/lib/validation";
import { pengadaanService } from "@/services/pengadaan";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

export const PATCH = route({ roles: ["ADMIN"] }, async (ctx) => {
  const id = idSchema.safeParse(ctx.params.id);
  if (!id.success) throw badRequest("ID tagihan tidak valid");
  const input = await ctx.body(invoiceActionSchema);
  return ok(await pengadaanService.setInvoiceStatus(id.data, input), "Status tagihan diperbarui");
});
