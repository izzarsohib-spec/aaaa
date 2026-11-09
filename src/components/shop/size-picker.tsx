"use client";

import { Select } from "@/components/ui";
import { PANTS_SIZES, SHIRT_SIZES } from "@/lib/shop";

export interface Sizes {
  shirt: string;
  pants: string;
}

export const EMPTY_SIZES: Sizes = { shirt: "", pants: "" };

export function SizePicker({ value, onChange, error }: { value: Sizes; onChange: (v: Sizes) => void; error?: boolean }) {
  return (
    <div className="grid gap-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Ukuran baju
          <Select value={value.shirt} onChange={(e) => onChange({ ...value, shirt: e.target.value })} aria-invalid={error && !value.shirt}>
            <option value="">Pilih ukuran</option>
            {SHIRT_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Ukuran celana
          <Select value={value.pants} onChange={(e) => onChange({ ...value, pants: e.target.value })} aria-invalid={error && !value.pants}>
            <option value="">Pilih ukuran</option>
            {PANTS_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </label>
      </div>
      {error && (!value.shirt || !value.pants) && (
        <p className="text-sm text-danger" role="alert">Pilih ukuran baju dan celana dulu.</p>
      )}
    </div>
  );
}
