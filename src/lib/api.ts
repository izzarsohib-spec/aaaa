import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { CSRF_HEADER, SESSION_COOKIE, csrfMatches, verifySessionToken, type Role, type Session } from "./auth";
import { AppError, badRequest, forbidden, unauthorized } from "./errors";
import { logger } from "./logger";
import { RATE, limit } from "./rate-limit";

const MAX_BODY = 1024 * 1024;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface PublicCtx {
  req: NextRequest;
  session: Session | null;
  params: Record<string, string>;
  query: URLSearchParams;
  requestId: string;
  ip: string;
  body: <T>(schema: ZodType<T>) => Promise<T>;
}
export type Ctx = Omit<PublicCtx, "session"> & { session: Session };

export interface Reply {
  data?: unknown;
  message?: string;
  status?: number;
  headers?: Record<string, string>;
  cookies?: { name: string; value: string; options: Record<string, unknown> }[];
}

export const ok = (data: unknown, message = "Berhasil", extra: Partial<Reply> = {}): Reply => ({
  data,
  message,
  ...extra,
});
export const created = (data: unknown, location: string, message = "Berhasil dibuat"): Reply => ({
  data,
  message,
  status: 201,
  headers: { Location: location },
});

function allowedOrigins(): string[] {
  return (process.env.APP_URL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function formatZod(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Peta pelanggaran constraint database ke 409, bukan 500. */
function mapDbError(err: unknown): AppError | null {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    const code = (e as { code?: string }).code;
    const constraint = (e as { constraint_name?: string }).constraint_name ?? "";
    if (code === "23505") {
      if (constraint.includes("products_sku")) {
        return new AppError(409, "SKU_ALREADY_EXISTS", "SKU sudah dipakai produk lain");
      }
      if (constraint.includes("email")) return new AppError(409, "DUPLICATE", "Email sudah terdaftar");
      return new AppError(409, "DUPLICATE", "Data duplikat");
    }
    if (code === "23503") {
      return new AppError(409, "REF_IN_USE", "Data masih dipakai oleh data lain");
    }
    if (code === "23514") {
      if (constraint === "products_price_gte_cost") {
        return new AppError(409, "PRICE_BELOW_COST", "Harga jual tidak boleh lebih kecil dari harga modal (HPP)");
      }
      if (constraint === "products_stock_nonneg") {
        return new AppError(409, "INSUFFICIENT_STOCK", "Stok tidak boleh negatif");
      }
      return new AppError(409, "CONSTRAINT_VIOLATION", "Data melanggar aturan basis data");
    }
    e = (e as { cause?: unknown }).cause;
  }
  return null;
}

interface Options {
  /** Peran yang diizinkan. Tanpa ini pun rute tetap wajib login (default tertutup). */
  roles?: Role[];
  public?: boolean;
}

type Handler<C> = (ctx: C) => Promise<Reply>;

function build<C>(opts: Options, handler: Handler<C>) {
  return async (req: NextRequest, routeCtx: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    const started = Date.now();
    const ip = clientIp(req);
    const path = req.nextUrl.pathname;
    let status = 500;
    try {
      const mutating = MUTATING.has(req.method);

      if (mutating) {
        const len = Number(req.headers.get("content-length") ?? 0);
        if (len > MAX_BODY) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Ukuran data terlalu besar (maks 1 MB)");
        const origin = req.headers.get("origin");
        const allow = allowedOrigins();
        if (origin && origin !== req.nextUrl.origin && !allow.includes(origin)) {
          throw forbidden("Origin tidak diizinkan");
        }
      }

      let session: Session | null = null;
      if (!opts.public) {
        session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
        if (!session) throw unauthorized();
        if (opts.roles && !opts.roles.includes(session.role)) throw forbidden();
        if (mutating && !csrfMatches(session.csrf, req.headers.get(CSRF_HEADER))) {
          throw forbidden("Token CSRF tidak valid");
        }
        if (mutating) limit("w:" + session.userId, RATE.write.max, RATE.write.windowMs);
        else limit("r:" + ip, RATE.read.max, RATE.read.windowMs);
      } else if (mutating) {
        limit("wp:" + ip, RATE.write.max, RATE.write.windowMs);
      } else {
        limit("r:" + ip, RATE.read.max, RATE.read.windowMs);
      }

      const ctx = {
        req,
        session,
        params: await routeCtx.params,
        query: req.nextUrl.searchParams,
        requestId,
        ip,
        body: async <T>(schema: ZodType<T>) => {
          let raw: unknown;
          const text = await req.text();
          if (text.length > MAX_BODY) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Ukuran data terlalu besar (maks 1 MB)");
          try {
            raw = text ? JSON.parse(text) : {};
          } catch {
            throw badRequest("Body JSON tidak valid");
          }
          return schema.parse(raw);
        },
      } as unknown as C;

      const reply = await handler(ctx);
      status = reply.status ?? 200;
      const res = NextResponse.json(
        { success: true, message: reply.message ?? "Berhasil", data: reply.data },
        { status, headers: { "x-request-id": requestId, ...reply.headers } },
      );
      for (const c of reply.cookies ?? []) res.cookies.set(c.name, c.value, c.options);
      return res;
    } catch (err) {
      let appErr: AppError | null = null;
      if (err instanceof AppError) appErr = err;
      else if (err instanceof ZodError) appErr = badRequest("Input tidak valid", formatZod(err));
      else appErr = mapDbError(err);

      if (!appErr) {
        logger.error("unhandled", {
          requestId,
          path,
          err: err instanceof Error ? err.name + ": " + err.message : String(err),
        });
        appErr = new AppError(500, "INTERNAL_ERROR", "Terjadi kesalahan pada server. Kode: " + requestId);
      }
      status = appErr.status;
      return NextResponse.json(
        {
          success: false,
          message: appErr.message,
          code: appErr.code,
          ...(appErr.errors ? { errors: appErr.errors } : {}),
        },
        { status, headers: { "x-request-id": requestId, ...appErr.headers } },
      );
    } finally {
      logger.info("request", { requestId, method: req.method, path, status, ms: Date.now() - started });
    }
  };
}

/** Rute terproteksi (default tertutup). */
export const route = (opts: Omit<Options, "public">, handler: Handler<Ctx>) => build<Ctx>({ ...opts }, handler);

/** Rute publik: harus ditandai eksplisit. */
export const publicRoute = (handler: Handler<PublicCtx>) => build<PublicCtx>({ public: true }, handler);

/** Parameter list baku: page, limit (maks 100, dipotong), search, sortBy (allow-list), sortOrder. */
export function pageParams(q: URLSearchParams, sortable: readonly string[], defaultSort: string) {
  const page = Math.max(1, Number.parseInt(q.get("page") ?? "1", 10) || 1);
  const limitRaw = Number.parseInt(q.get("limit") ?? "20", 10) || 20;
  const limit = Math.min(100, Math.max(1, limitRaw));
  const sortBy = sortable.includes(q.get("sortBy") ?? "") ? (q.get("sortBy") as string) : defaultSort;
  const sortOrder = q.get("sortOrder") === "desc" ? ("desc" as const) : ("asc" as const);
  return { page, limit, offset: (page - 1) * limit, search: (q.get("search") ?? "").trim(), sortBy, sortOrder };
}

export function paged<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
