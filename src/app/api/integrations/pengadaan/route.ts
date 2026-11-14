import { ok, publicRoute } from "@/lib/api";
import { AppError, badRequest, unauthorized } from "@/lib/errors";
import { pengadaanEventSchema } from "@/lib/validation";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyPayload } from "@/lib/webhook";
import { pengadaanService } from "@/services/pengadaan";

export const runtime = "nodejs";

/**
 * Penerima kiriman dari sistem pengadaan (server ke server, tanpa cookie).
 * Keamanan: tanda tangan HMAC atas "<timestamp>.<body mentah>" dengan rahasia bersama.
 */
export const POST = publicRoute(async (ctx) => {
  const secret = process.env.PENGADAAN_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError(503, "NOT_CONFIGURED", "Integrasi pengadaan belum dikonfigurasi di server");
  }
  const raw = await ctx.req.text();
  const valid = verifyPayload(
    secret,
    ctx.req.headers.get(TIMESTAMP_HEADER),
    ctx.req.headers.get(SIGNATURE_HEADER),
    raw,
  );
  if (!valid) throw unauthorized("Tanda tangan tidak valid");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw badRequest("Body JSON tidak valid");
  }
  const result = await pengadaanService.handle(pengadaanEventSchema.parse(json));
  return ok(result, result.duplicate ? "Kiriman sudah pernah diproses" : "Kiriman diterapkan");
});
