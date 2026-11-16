"use client";

import Link from "next/link";

/** Judul + tab sub halaman klien titipan (Stok | Tagihan). */
export function TitipanTabs({ code, name, active }: { code: string; name: string; active: "stok" | "tagihan" }) {
  const tabs = [
    ["stok", "Stok"],
    ["tagihan", "Tagihan"],
  ] as const;
  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm text-muted">
          <Link href="/titipan" className="hover:underline">
            Titipan Seragam
          </Link>
          {" / "}
          {name}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
      </div>
      <nav aria-label="Sub halaman titipan" className="flex gap-1 border-b border-border">
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={"/titipan/" + encodeURIComponent(code) + "/" + id}
            aria-current={active === id ? "page" : undefined}
            className="-mb-px flex min-h-10 items-center border-b-2 border-transparent px-4 text-sm font-medium text-muted hover:text-foreground aria-[current=page]:border-accent aria-[current=page]:text-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
