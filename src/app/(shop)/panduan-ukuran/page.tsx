const SHIRT = [
  ["S", "92", "66", "70"],
  ["M", "96", "68", "72"],
  ["L", "100", "70", "74"],
  ["XL", "106", "72", "76"],
  ["XXL", "112", "74", "78"],
];
const PANTS = [
  ["S", "72", "100", "98"],
  ["M", "76", "104", "100"],
  ["L", "82", "108", "102"],
  ["XL", "88", "112", "104"],
  ["XXL", "94", "116", "106"],
];

function SizeTable({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} scope="col" className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>
                {r.map((c, i) => (
                  <td key={i} className={"border-b border-border px-4 py-3 last:border-b-0 " + (i === 0 ? "font-semibold" : "")}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SizeGuidePage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Panduan Ukuran Seragam</h1>
        <p className="mt-1 text-sm text-muted">Semua angka dalam cm. Ini ukuran contoh; pastikan lagi ke toko untuk ukuran produk tertentu.</p>
      </div>
      <SizeTable title="Baju" head={["Ukuran", "Lingkar dada", "Lebar bahu", "Panjang baju"]} rows={SHIRT} />
      <SizeTable title="Celana" head={["Ukuran", "Lingkar pinggang", "Lingkar pinggul", "Panjang celana"]} rows={PANTS} />
      <section className="rounded-lg border border-border bg-surface p-5 text-sm">
        <h2 className="mb-2 font-semibold">Cara mengukur</h2>
        <ol className="grid gap-1.5">
          <li>1. Lingkar dada: ukur bagian dada terlebar, meteran tidak terlalu kencang.</li>
          <li>2. Panjang baju: dari titik tertinggi bahu hingga ujung bawah baju.</li>
          <li>3. Lingkar pinggang: ukur bagian pinggang paling kecil.</li>
          <li>4. Bila ragu di antara dua ukuran, pilih yang lebih besar.</li>
        </ol>
      </section>
    </div>
  );
}
