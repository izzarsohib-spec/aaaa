import { z } from "zod";
import { badRequest } from "@/lib/errors";
import { ok, route } from "@/lib/api";
import { productUpdateSchema } from "@/lib/validation";
import { productService } from "@/services";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

export const PATCH = route({ roles: ["ADMIN"] }, async (ctx) => {
  const id = idSchema.safeParse(ctx.params.id);
  if (!id.success) throw badRequest("ID produk tidak valid");
  const input = await ctx.body(productUpdateSchema);
  return ok(await productService.update(id.data, input, ctx.session.role), "Produk berhasil diperbarui");
});

export const DELETE = route({ roles: ["ADMIN"] }, async (ctx) => {
  const id = idSchema.safeParse(ctx.params.id);
  if (!id.success) throw badRequest("ID produk tidak valid");
  await productService.remove(id.data);
  return ok(null, "Produk dihapus (soft-delete); riwayat transaksi tetap tersimpan");
});
