import { z } from "zod";
import { ok, route } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { pengadaanService } from "@/services/pengadaan";

export const runtime = "nodejs";

const codeSchema = z.string().trim().min(1).max(30);

export const GET = route({ roles: ["ADMIN"] }, async (ctx) => {
  const code = codeSchema.safeParse(ctx.params.code);
  if (!code.success) throw badRequest("Kode klien tidak valid");
  return ok(await pengadaanService.clientStock(code.data));
});
