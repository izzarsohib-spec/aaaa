import { redirect } from "next/navigation";

export default async function KlienTitipanPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect("/titipan/" + encodeURIComponent(code) + "/stok");
}
