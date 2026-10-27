/* Ilustrasi pengganti foto produk (dipakai bila image_url kosong). */

const ART: Record<string, { bg: string; shape: React.ReactNode }> = {
  "Seragam Satpam": {
    bg: "#efe6d2",
    shape: (
      <g>
        <path d="M30 26 48 16 60 30 72 16 90 26 106 52 92 60 86 50 86 106 34 106 34 50 28 60 14 52Z" fill="#c8b184" stroke="#8a7650" strokeWidth="2" />
        <path d="M48 16 60 38 72 16" fill="#b79f6f" stroke="#8a7650" strokeWidth="2" />
        <rect x="40" y="58" width="14" height="14" rx="2" fill="#b79f6f" stroke="#8a7650" />
        <rect x="66" y="58" width="14" height="14" rx="2" fill="#b79f6f" stroke="#8a7650" />
        <circle cx="60" cy="52" r="2" fill="#8a7650" />
        <circle cx="60" cy="68" r="2" fill="#8a7650" />
        <circle cx="60" cy="84" r="2" fill="#8a7650" />
        <rect x="95" y="52" width="8" height="8" fill="#0b2559" />
      </g>
    ),
  },
  Celana: {
    bg: "#e5e9f2",
    shape: <path d="M34 14h52l6 92H66L60 48l-6 58H28Z" fill="#26324a" stroke="#101a30" strokeWidth="2" />,
  },
  Sepatu: {
    bg: "#e9e9ec",
    shape: (
      <g>
        <path d="M34 20h30v34l30 14c8 4 12 8 12 20v6H26V20Z" fill="#1f1f24" stroke="#0e0e12" strokeWidth="2" />
        <rect x="26" y="88" width="80" height="8" fill="#3a3a42" />
        <path d="M36 34h24M36 44h24M36 54h24" stroke="#8c8c96" strokeWidth="2" />
      </g>
    ),
  },
  Topi: {
    bg: "#e5e9f2",
    shape: (
      <g>
        <path d="M24 74c0-30 16-44 38-44s38 14 38 44Z" fill="#14203d" stroke="#0a1226" strokeWidth="2" />
        <path d="M20 74h92c0 10-14 16-46 16S20 84 20 74Z" fill="#0b2559" stroke="#0a1226" strokeWidth="2" />
        <circle cx="62" cy="54" r="9" fill="#f5a524" stroke="#b9771a" strokeWidth="2" />
      </g>
    ),
  },
  Atribut: {
    bg: "#f3ead0",
    shape: (
      <g>
        <path d="M60 14 98 28v30c0 24-16 40-38 48C38 98 22 82 22 58V28Z" fill="#f5a524" stroke="#b9771a" strokeWidth="2" />
        <path d="M60 34l6 13 14 2-10 10 3 14-13-7-13 7 3-14-10-10 14-2Z" fill="#0b2559" />
      </g>
    ),
  },
  "Paket Hemat": {
    bg: "#e5ecfb",
    shape: (
      <g>
        <rect x="22" y="40" width="76" height="62" rx="4" fill="#c8b184" stroke="#8a7650" strokeWidth="2" />
        <rect x="22" y="40" width="76" height="16" fill="#b79f6f" stroke="#8a7650" strokeWidth="2" />
        <rect x="54" y="40" width="12" height="62" fill="#1d4ed8" />
        <path d="M60 40c-14-18-30-8-18 0Zm0 0c14-18 30-8 18 0Z" fill="#1d4ed8" />
      </g>
    ),
  },
  Lainnya: {
    bg: "#eeeeee",
    shape: (
      <g>
        <path d="M24 20h40l36 36-40 40-36-36Z" fill="#9aa3b5" stroke="#5f6b85" strokeWidth="2" />
        <circle cx="44" cy="40" r="6" fill="#eeeeee" />
      </g>
    ),
  },
};

export function ProductArt({ category, name, src, className }: { category: string; name: string; src?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} loading="lazy" className={"aspect-square w-full rounded-md object-cover " + (className ?? "")} />;
  }
  const art = ART[category] ?? ART.Lainnya;
  return (
    <div className={"aspect-square w-full overflow-hidden rounded-md " + (className ?? "")} style={{ background: art.bg }}>
      <svg viewBox="0 0 120 120" role="img" aria-label={name} className="h-full w-full">
        {art.shape}
      </svg>
    </div>
  );
}
