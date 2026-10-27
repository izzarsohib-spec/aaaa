"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { STORE, whatsappLink } from "@/lib/shop";
import { CartProvider, useCart } from "./cart";

const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/katalog", label: "Semua Produk" },
  { href: "/katalog?category=Seragam%20Satpam", label: "Seragam" },
  { href: "/katalog?category=Sepatu", label: "Sepatu" },
  { href: "/katalog?category=Atribut", label: "Atribut" },
  { href: "/katalog?category=Paket%20Hemat", label: "Paket Hemat" },
  { href: "/grosir", label: "Grosir & Custom Logo" },
  { href: "/panduan-ukuran", label: "Panduan Ukuran" },
  { href: "/pesanan", label: "Lacak Pesanan" },
];

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 4h2l2.4 11h10.2L20 7H6.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="19" r="1.6" />
      <circle cx="17" cy="19" r="1.6" />
    </svg>
  );
}

function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { count } = useCart();
  const [q, setQ] = useState("");

  function search(e: FormEvent) {
    e.preventDefault();
    router.push("/katalog?q=" + encodeURIComponent(q.trim()));
  }

  return (
    <header className="no-print sticky top-0 z-30 bg-navy text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          ADZKIA <span className="text-gold">COLLECTION</span>
        </Link>
        <form onSubmit={search} role="search" className="order-3 flex w-full md:order-none md:max-w-md md:flex-1">
          <input
            aria-label="Cari produk"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari produk, seragam, sepatu, atribut"
            className="min-h-10 w-full rounded-l-md border-0 bg-white px-3 text-sm text-foreground"
          />
          <button type="submit" className="min-h-10 rounded-r-md bg-gold px-4 text-sm font-semibold text-navy hover:bg-gold-hover">
            Cari
          </button>
        </form>
        <div className="ml-auto flex items-center gap-1">
          <Link href="/keranjang" aria-label={"Keranjang, " + count + " barang"} className="relative rounded-md p-2 hover:bg-white/10">
            <CartIcon />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-bold text-navy">
                {count}
              </span>
            )}
          </Link>
          <Link href="/login" className="rounded-md px-3 py-2 text-sm text-blue-100 hover:bg-white/10">
            Masuk Staf
          </Link>
        </div>
      </div>
      <nav aria-label="Menu toko" className="bg-navy-deep">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {NAV.map((n) => {
            const current = n.href === "/" ? pathname === "/" : pathname === n.href.split("?")[0] && !n.href.includes("?");
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={current ? "page" : undefined}
                className="whitespace-nowrap px-3 py-2.5 text-sm text-blue-100 hover:text-white aria-[current=page]:border-b-2 aria-[current=page]:border-gold aria-[current=page]:text-white"
              >
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="no-print mt-16 bg-navy-deep text-blue-100">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-white">
            ADZKIA <span className="text-gold">COLLECTION</span>
          </p>
          <p className="mt-2 max-w-[40ch] text-sm">{STORE.tagline}. Seragam, sepatu, topi, dan atribut untuk satpam di seluruh Indonesia.</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Bantuan</p>
          <ul className="mt-2 grid gap-1.5">
            <li><Link href="/bantuan" className="hover:text-white">Pusat Bantuan</Link></li>
            <li><Link href="/panduan-ukuran" className="hover:text-white">Panduan Ukuran</Link></li>
            <li><Link href="/pesanan" className="hover:text-white">Lacak Pesanan</Link></li>
            <li><Link href="/tentang" className="hover:text-white">Tentang & Kontak</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Hubungi kami</p>
          <ul className="mt-2 grid gap-1.5">
            <li>
              <a href={whatsappLink("Halo Adzkia Collection, saya ingin bertanya.")} className="hover:text-white" target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </li>
            <li>{STORE.email}</li>
            <li>{STORE.hours}</li>
          </ul>
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs">© {new Date().getFullYear()} {STORE.name}</p>
    </footer>
  );
}

export function ShopShell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <Header />
      {process.env.NEXT_PUBLIC_DEMO ? (
        <p className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          Mode demo: produk dan pesanan hanya contoh dan tersimpan di browser ini. Pemilik/kasir masuk lewat "Masuk Staf" (password demo1234).
        </p>
      ) : null}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <Footer />
    </CartProvider>
  );
}
