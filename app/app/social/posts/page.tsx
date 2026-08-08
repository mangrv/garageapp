import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import PostsManagerClient from "../../user/posts/PostsManagerClient";
import SocialTabs from "../SocialTabs";

export default async function SocialPostsPage() {
  const session = await requireSession().catch(() => null);
  if (!session) redirect("/login?next=/social/posts");
  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--background)" }}>
      <SocialTabs active="posts" />
      <PostsManagerClient />
    </div>
  );
}
