import { redirect } from "next/navigation";

export default async function ReturnIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/returns/${id}/interview`);
}
