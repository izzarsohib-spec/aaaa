import { z } from "zod";
import { ok, pageParams, paged, route } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { pengadaanService } from "@/services/pengadaan";

export const runtime = "nodejs";

const codeSchema = z.string().trim().min(1).max(30);

/** Riwayat barang masuk dan keluar titipan satu klien. Query: direction=IN|OUT, search, page, limit. */
export const GET = route({ roles: ["ADMIN"] }, async (ctx) => {
  const code = codeSchema.safeParse(ctx.params.code);
  if (!code.success) throw badRequest("Kode klien tidak valid");
  const p = pageParams(ctx.query, ["created_at"], "created_at");
  const raw = ctx.query.get("direction");
  const direction = raw === "IN" || raw === "OUT" ? raw : undefined;
  const { items, total } = await pengadaanService.clientMoves(code.data, {
    limit: p.limit,
    offset: p.offset,
    direction,
    search: p.search || undefined,
  });
  return ok(paged(items, total, p.page, p.limit));
});
