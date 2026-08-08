import { redirect } from "next/navigation";

export default async function EditCarRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/cars/${id}`);
}
