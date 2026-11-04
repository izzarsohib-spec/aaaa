/* Pembuat PDF permintaan penawaran grosir. Berjalan di browser; pustaka dimuat saat dibutuhkan agar halaman tetap ringan. */

export type PdfItem = { name: string; lines: { label: string; text: string }[]; total: number };
export type PdfSection = { title: string; unit: string; sizes: boolean; items: PdfItem[] };
export type PdfOrder = {
  storeName: string;
  tagline: string;
  number: string;
  dateText: string;
  /* Pasangan label dan isi untuk blok "Data pemesan". */
  fields: [string, string][];
  sections: PdfSection[];
  notes: string;
};

const NAVY: [number, number, number] = [11, 37, 89];
const GOLD: [number, number, number] = [245, 165, 36];
const MUTED: [number, number, number] = [107, 112, 128];
const LINE: [number, number, number] = [216, 219, 227];
const M = 40;

export async function buildOrderPdf(o: PdfOrder): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const inner = W - M * 2;
  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Kop
  doc.setFillColor(...NAVY).rect(0, 0, W, 72, "F");
  doc.setFillColor(...GOLD).rect(0, 72, W, 3, "F");
  const [first, ...rest] = o.storeName.toUpperCase().split(" ");
  doc.setFont("helvetica", "bold").setFontSize(19).setTextColor(255, 255, 255).text(first + " ", M, 38);
  doc.setTextColor(...GOLD).text(rest.join(" "), M + doc.getTextWidth(first + " "), 38);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(220, 226, 240).text(o.tagline, M, 54);
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(255, 255, 255).text("Permintaan Penawaran Grosir", W - M, 36, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(220, 226, 240).text(o.dateText + "  |  No. " + o.number, W - M, 52, { align: "right" });

  let y = 100;
  const need = (h: number) => {
    if (y + h > H - 60) {
      doc.addPage();
      y = M;
    }
  };
  const heading = (title: string) => {
    need(60);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...NAVY).text(title.toUpperCase(), M, y);
    const w = doc.getTextWidth(title.toUpperCase());
    doc.setDrawColor(...LINE).setLineWidth(0.7).line(M + w + 10, y - 3, W - M, y - 3);
    y += 10;
  };

  // Data pemesan: dua pasang per baris
  heading("Data pemesan");
  const rows: string[][] = [];
  for (let i = 0; i < o.fields.length; i += 2) {
    const a = o.fields[i];
    const b = o.fields[i + 1];
    rows.push(b ? [a[0], a[1], b[0], b[1]] : [a[0], a[1], "", ""]);
  }
  autoTable(doc, {
    startY: y,
    body: rows,
    theme: "plain",
    margin: { left: M, right: M },
    styles: { fontSize: 10, cellPadding: { top: 3, bottom: 3, left: 0, right: 6 }, textColor: [28, 28, 30] },
    columnStyles: {
      0: { cellWidth: 80, textColor: MUTED, fontSize: 9 },
      1: { fontStyle: "bold", cellWidth: inner / 2 - 80 },
      2: { cellWidth: 80, textColor: MUTED, fontSize: 9 },
      3: { fontStyle: "bold" },
    },
  });
  y = finalY() + 26;

  // Tabel per kategori
  for (const s of o.sections) {
    heading(s.title);
    const head = s.sizes ? ["No", "Barang", "Ukuran dan jumlah", "Subtotal"] : ["No", "Barang", "Jumlah"];
    const body = s.items.map((it, i) =>
      s.sizes
        ? [String(i + 1), it.name, it.lines.map((l) => l.label + ":  " + l.text).join("\n"), it.total + " " + s.unit]
        : [String(i + 1), it.name, it.total + " " + s.unit],
    );
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: M, right: M },
      theme: "plain",
      rowPageBreak: "avoid",
      styles: { fontSize: 10, cellPadding: { top: 7, bottom: 7, left: 8, right: 8 }, textColor: [28, 28, 30], lineColor: [230, 232, 239], lineWidth: { bottom: 0.6 }, valign: "top" },
      headStyles: { fillColor: [238, 241, 248], textColor: [68, 80, 107], fontSize: 8, fontStyle: "bold", lineWidth: 0 },
      columnStyles: s.sizes
        ? { 0: { cellWidth: 30, textColor: MUTED }, 1: { cellWidth: 150, fontStyle: "bold" }, 2: { cellWidth: "auto" }, 3: { cellWidth: 82, halign: "right", fontStyle: "bold" } }
        : { 0: { cellWidth: 30, textColor: MUTED }, 1: { cellWidth: "auto", fontStyle: "bold" }, 2: { cellWidth: 82, halign: "right", fontStyle: "bold" } },
      didParseCell: (d) => {
        if (d.section === "head" && d.column.index === head.length - 1) d.cell.styles.halign = "right";
      },
    });
    y = finalY() + 28;
  }

  // Ringkasan
  heading("Ringkasan");
  need(70);
  const gap = 12;
  const bw = (inner - gap * (o.sections.length - 1)) / o.sections.length;
  o.sections.forEach((s, i) => {
    const x = M + i * (bw + gap);
    const total = s.items.reduce((a, it) => a + it.total, 0);
    doc.setDrawColor(...LINE).setLineWidth(0.8).roundedRect(x, y, bw, 58, 6, 6, "S");
    doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...NAVY).text(String(total), x + bw / 2, y + 26, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text(s.unit + " " + s.title.toLowerCase(), x + bw / 2, y + 40, { align: "center" });
    doc.text(s.items.length + " jenis", x + bw / 2, y + 51, { align: "center" });
  });
  y += 86;

  // Catatan
  heading("Catatan");
  const noteLines = doc.setFont("helvetica", "normal").setFontSize(10).splitTextToSize(o.notes || "-", inner - 22);
  const nh = noteLines.length * 13 + 16;
  need(nh + 10);
  doc.setFillColor(247, 248, 251).rect(M, y, inner, nh, "F");
  doc.setFillColor(...GOLD).rect(M, y, 3, nh, "F");
  doc.setTextColor(28, 28, 30).text(noteLines, M + 14, y + 17);
  y += nh + 22;

  // Keterangan penutup
  const foot = doc
    .setFontSize(8.5)
    .setTextColor(...MUTED)
    .splitTextToSize("Dokumen ini adalah permintaan penawaran, bukan pesanan final. Harga dan ketersediaan barang akan dikonfirmasi oleh " + o.storeName + " melalui WhatsApp.", inner);
  need(foot.length * 11 + 14);
  doc.setDrawColor(...LINE).line(M, y, W - M, y);
  doc.text(foot, M, y + 14);

  // Nomor halaman
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8).setTextColor(...MUTED).text("Halaman " + p + " dari " + pages, W - M, H - 24, { align: "right" });
    doc.text(o.number, M, H - 24);
  }
  return doc.output("blob");
}
