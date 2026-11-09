"use client";

import { Input, Select } from "@/components/ui";
import { sumRows, type SizeRow } from "@/lib/shop";

/** Satu kolom pembagian ukuran: tiap baris = ukuran + jumlahnya; total harus sama dengan jumlah seragam. */
export function SizeBreakdown({
  title,
  options,
  rows,
  onChange,
  total,
  error,
}: {
  title: string;
  options: readonly string[];
  rows: SizeRow[];
  onChange: (rows: SizeRow[]) => void;
  total: number;
  error: boolean;
}) {
  const sum = sumRows(rows);
  const ok = sum === total && rows.every((r) => r.size && r.qty > 0);
  const set = (i: number, patch: Partial<SizeRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="grid content-start gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <p className={"text-sm font-semibold " + (ok ? "text-green-700" : sum > total ? "text-danger" : "text-muted")}>
          {sum} / {total}
        </p>
      </div>
      <ul className="grid h-44 content-start gap-2 overflow-y-auto pr-1">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[1fr_4.5rem_2rem] items-center gap-2">
            <Select aria-label={title + " baris " + (i + 1)} value={r.size} onChange={(e) => set(i, { size: e.target.value })} aria-invalid={error && !r.size}>
              <option value="">Pilih ukuran</option>
              {options.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </Select>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              aria-label={"Jumlah " + title.toLowerCase() + " baris " + (i + 1)}
              value={r.qty || ""}
              onChange={(e) => set(i, { qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
            <button
              type="button"
              disabled={rows.length <= 1}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="text-lg leading-none text-danger hover:opacity-70 disabled:opacity-30"
              aria-label={"Hapus baris " + (i + 1)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...rows, { size: "", qty: Math.max(0, total - sum) }])}
        className="justify-self-start text-sm font-medium text-accent hover:underline"
      >
        + Tambah baris
      </button>
      {error && !ok && (
        <p className="text-sm text-danger" role="alert">
          {sum !== total ? "Jumlah harus " + total + " (sekarang " + sum + ")." : "Lengkapi ukuran dan jumlah tiap baris."}
        </p>
      )}
    </div>
  );
}
