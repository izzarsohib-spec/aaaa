import { STORE, whatsappLink } from "@/lib/shop";

export default function AboutPage() {
  return (
    <div className="grid max-w-2xl gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Tentang Kami &amp; Kontak</h1>
      <p className="text-sm leading-relaxed">
        {STORE.name} menyediakan seragam satpam, sepatu, topi, dan atribut untuk perorangan maupun perusahaan. Kami menerima pemesanan satuan, grosir, dan custom logo.
      </p>
      <section className="grid gap-2 rounded-lg border border-border bg-surface p-5 text-sm">
        <h2 className="font-semibold">Informasi kontak</h2>
        <p>{STORE.address}</p>
        <p>{STORE.email}</p>
        <p>{STORE.hours}</p>
        <a href={whatsappLink("Halo " + STORE.name + ", saya ingin bertanya.")} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
          Chat WhatsApp
        </a>
      </section>
    </div>
  );
}
