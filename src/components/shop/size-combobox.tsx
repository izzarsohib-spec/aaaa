"use client";

import { useId, useState } from "react";

/* Kolom cari + daftar pilihan ukuran. Teks yang diketik menyaring daftar; nilai hanya berubah bila memilih salah satu opsi. */
export function SizeCombobox({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  label: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const shown = options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()));

  function pick(v: string) {
    onChange(v);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Cari / pilih ukuran"
        value={open ? query : value}
        onFocus={() => {
          setQuery("");
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (shown[active]) pick(shown[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className="min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden className="pointer-events-none absolute right-3 top-3 text-muted">
        <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg">
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">Ukuran tidak ditemukan</li>}
          {shown.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={o === value}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={"cursor-pointer px-3 py-2 text-sm" + (i === active ? " bg-zinc-100" : "") + (o === value ? " font-semibold" : "")}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
