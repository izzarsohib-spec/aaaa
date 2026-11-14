import { ok, route } from "@/lib/api";
import { pengadaanService } from "@/services/pengadaan";

export const runtime = "nodejs";

export const GET = route({ roles: ["ADMIN"] }, async () => ok(await pengadaanService.summary()));
