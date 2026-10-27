import { ok, route } from "@/lib/api";

export const runtime = "nodejs";

export const GET = route({}, async ({ session }) =>
  ok({ id: session.userId, name: session.name, role: session.role }),
);
