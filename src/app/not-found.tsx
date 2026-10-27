import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-4">
      <div className="grid justify-items-start gap-3">
        <p className="text-sm font-medium text-accent">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
        <p className="max-w-[44ch] text-sm text-muted">Alamat yang Anda buka tidak ada atau sudah dipindahkan.</p>
        <Link href="/dashboard" className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">
          Kembali ke dashboard
        </Link>
      </div>
    </main>
  );
}
