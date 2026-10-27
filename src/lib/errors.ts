export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly errors?: Record<string, string>,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, errors?: Record<string, string>) =>
  new AppError(400, "VALIDATION_ERROR", message, errors);
export const unauthorized = (message = "Silakan login terlebih dahulu") =>
  new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Anda tidak berhak mengakses ini") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Data tidak ditemukan") => new AppError(404, "NOT_FOUND", message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const tooMany = (message: string, retryAfterSec: number) =>
  new AppError(429, "RATE_LIMITED", message, undefined, {
    "Retry-After": String(Math.max(1, Math.ceil(retryAfterSec))),
  });
