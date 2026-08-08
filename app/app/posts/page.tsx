import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function PostsRedirectPage() {
  const session = await requireSession().catch(() => null);
  if (!session) redirect("/login");
  redirect("/social/posts");
}
