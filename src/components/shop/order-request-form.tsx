"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Field, Input } from "@/components/ui";
import { WHOLESALE_WHATSAPP, whatsappLink } from "@/lib/shop";

/* Formulir permintaan penawaran yang dikirim lewat WhatsApp. Kolom pembuka (perusahaan, PIC, WA) sama untuk Grosir dan Custom Logo. */
export function OrderRequestForm({
  title,
  intro,
  heading,
  children,
  buildLines,
  validate,
}: {
  title: string;
  intro: string;
  heading: string;
  children: ReactNode;
  buildLines: (get: (k: string) => string, f: FormData) => string[];
  validate?: (f: FormData) => string | null;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const problem = validate?.(f) ?? null;
    setError(problem);
    if (problem) return;
    const get = (k: string) => String(f.get(k) ?? "").trim();
    const msg = [
      heading,
      "Perusahaan: " + get("company"),
      "PIC: " + get("pic"),
      "No. WhatsApp: " + get("phone"),
      ...buildLines(get, f),
    ].join("\n");
    window.open(whatsappLink(msg, WHOLESALE_WHATSAPP), "_blank", "noopener");
    setSent(true);
  }

  return (
    <div className="grid max-w-2xl gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{intro}</p>
      </div>
      <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama perusahaan / instansi">{(a) => <Input {...a} name="company" required />}</Field>
          <Field label="Nama PIC">{(a) => <Input {...a} name="pic" required />}</Field>
        </div>
        <Field label="Nomor WhatsApp">{(a) => <Input {...a} name="phone" type="tel" required />}</Field>
        {children}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit">Kirim permintaan via WhatsApp</Button>
        {sent && <p role="status" className="text-sm text-muted">WhatsApp terbuka di tab baru. Bila tidak terbuka, izinkan pop-up lalu kirim ulang.</p>}
      </form>
    </div>
  );
}
