import { randomBytes, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export type Role = "ADMIN" | "STAFF";
export interface Session {
  userId: string;
  role: Role;
  name: string;
  csrf: string;
}

export const SESSION_COOKIE = "adzkia_session";
export const CSRF_COOKIE = "adzkia_csrf";
export const CSRF_HEADER = "x-csrf-token";
const MAX_AGE_SEC = 60 * 60 * 12;

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET wajib diisi (minimal 32 karakter)");
  return new TextEncoder().encode(s);
}

export async function signSession(s: Omit<Session, "csrf">): Promise<{ token: string; csrf: string }> {
  const csrf = randomBytes(24).toString("hex");
  const token = await new SignJWT({ role: s.role, name: s.name, csrf })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime(MAX_AGE_SEC + "s")
    .sign(secret());
  return { token, csrf };
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || (payload.role !== "ADMIN" && payload.role !== "STAFF")) return null;
    return {
      userId: payload.sub,
      role: payload.role,
      name: String(payload.name ?? ""),
      csrf: String(payload.csrf ?? ""),
    };
  } catch {
    return null;
  }
}

/** Untuk Server Components / halaman. */
export async function getSession(): Promise<Session | null> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function csrfCookieOptions() {
  return { ...sessionCookieOptions(), httpOnly: false };
}

export function csrfMatches(expected: string, given: string | null): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
