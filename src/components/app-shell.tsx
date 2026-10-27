"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { api } from "@/lib/client";

export interface SessionInfo {
  name: string;
  role: "ADMIN" | "STAFF";
}
const SessionCtx = createContext<SessionInfo>({ name: "", role: "STAFF" });
export const useSession = () => useContext(SessionCtx);

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sales/pos", label: "Kasir" },
  { href: "/orders", label: "Pesanan Online" },
  { href: "/sales", label: "Riwayat" },
  { href: "/products", label: "Produk" },
  { href: "/stock", label: "Stok" },
  { href: "/users", label: "Staf", adminOnly: true },
];

export function AppShell({ session, children }: { session: SessionInfo; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const active = (href: string) =>
    href === "/sales" ? pathname === "/sales" || /^\/sales\/(?!pos)/.test(pathname) : pathname.startsWith(href);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <SessionCtx.Provider value={session}>
      <header className="no-print sticky top-0 z-30 bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            ADZKIA <span className="text-gold">COLLECTION</span>
          </Link>
          <nav aria-label="Menu utama" className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
            {NAV.filter((n) => !n.adminOnly || session.role === "ADMIN").map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-blue-100 hover:bg-white/10 aria-[current=page]:bg-white/15 aria-[current=page]:text-white"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/" className="hidden rounded-md px-3 py-2 text-blue-100 hover:bg-white/10 lg:inline">
              Lihat toko
            </Link>
            <span className="hidden xl:inline">
              {session.name} <span className="text-blue-200">({session.role === "ADMIN" ? "Pemilik" : "Kasir"})</span>
            </span>
            <button
              onClick={logout}
              className="inline-flex min-h-10 items-center rounded-md border border-white/30 px-4 text-sm font-medium hover:bg-white/10"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </SessionCtx.Provider>
  );
}
