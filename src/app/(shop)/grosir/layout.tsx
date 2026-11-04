"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/grosir", label: "Grosir" },
  { href: "/grosir/custom-logo", label: "Custom Logo" },
];

export default function WholesaleLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/\/$/, "");
  return (
    <div className="grid gap-5">
      <div role="tablist" aria-label="Jenis pemesanan" className="flex max-w-2xl gap-1 border-b border-border">
        {TABS.map((t) => {
          const current = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              role="tab"
              aria-selected={current}
              aria-current={current ? "page" : undefined}
              className="-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground aria-[current=page]:border-gold aria-[current=page]:text-foreground"
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
