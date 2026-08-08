import { redirect } from "next/navigation";

export default function SocialMyFeedRedirect() {
  redirect("/social/posts");
}
