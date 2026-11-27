import { redirect } from "next/navigation";

// /result/{id} → 1쪽
export default async function ResultIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/result/${encodeURIComponent(id)}/1`);
}
