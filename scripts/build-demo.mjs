// Build demo statis untuk GitHub Pages: node scripts/build-demo.mjs
// Hasil: .demo-out/ (siap dipublikasikan). Proyek asli tidak diubah.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const tmp = path.join(root, ".demo-build");
const out = path.join(root, ".demo-out");
const BASE = process.env.DEMO_BASE_PATH ?? "/aaaa";

rmSync(tmp, { recursive: true, force: true });
rmSync(out, { recursive: true, force: true });
mkdirSync(tmp);

for (const f of ["src", "public", "package.json", "tsconfig.json", "postcss.config.mjs", "eslint.config.mjs"]) {
  if (existsSync(path.join(root, f))) cpSync(path.join(root, f), path.join(tmp, f), { recursive: true });
}
symlinkSync(path.join(root, "node_modules"), path.join(tmp, "node_modules"), "junction");

// Bagian server tidak ikut: API, health, proxy.
for (const f of ["src/app/api", "src/app/health", "src/proxy.ts"]) rmSync(path.join(tmp, f), { recursive: true, force: true });

writeFileSync(
  path.join(tmp, "next.config.ts"),
  `import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  basePath: "${BASE}",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } } },
};
export default nextConfig;
`,
);

const banner = `function DemoBanner() {
  return (
    <div className="no-print mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      Mode demo: data contoh tersimpan di browser ini saja, bukan data toko asli. Akun: admin@demo.id (pemilik) atau kasir@demo.id (kasir), password demo1234.
    </div>
  );
}`;

writeFileSync(
  path.join(tmp, "src/app/(app)/layout.tsx"),
  `"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { demoSession } from "@/lib/demo-api";

${banner}

export default function DemoLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<{ name: string; role: "ADMIN" | "STAFF" } | null>(null);

  useEffect(() => {
    const s = demoSession();
    if (!s) router.replace("/login");
    else if (s.role !== "ADMIN" && pathname.startsWith("/users")) router.replace("/dashboard");
    else setSession(s);
  }, [router, pathname]);

  if (!session) return null;
  return (
    <AppShell session={session}>
      <DemoBanner />
      {children}
    </AppShell>
  );
}
`,
);

writeFileSync(
  path.join(tmp, "src/app/(auth)/login/page.tsx"),
  `"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Card } from "@/components/ui";
import { demoSession } from "@/lib/demo-api";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    if (demoSession()) router.replace("/dashboard");
  }, [router]);
  return (
    <main className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="grid w-full max-w-sm gap-6">
        <div>
          <p className="text-sm font-medium text-accent">Adzkia Collection</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Masuk ke pembukuan toko</h1>
          <p className="mt-1 text-sm text-muted">Versi demo dengan data contoh.</p>
        </div>
        <Card>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </Card>
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Akun demo (password: demo1234)</p>
          <p>Pemilik: admin@demo.id</p>
          <p>Kasir: kasir@demo.id</p>
        </div>
      </div>
    </main>
  );
}
`,
);

const run = spawnSync("npx", ["next", "build"], {
  cwd: tmp,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_DEMO: "1", NEXT_PUBLIC_BASE_PATH: BASE },
});
if (run.status !== 0) process.exit(run.status ?? 1);

cpSync(path.join(tmp, "out"), out, { recursive: true });
writeFileSync(path.join(out, ".nojekyll"), "");
rmSync(tmp, { recursive: true, force: true });
console.log("Demo siap di .demo-out (basePath " + BASE + ")");
