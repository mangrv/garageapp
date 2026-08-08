import { redirect } from "next/navigation";

export default function UserPostsRedirect() {
  redirect("/social/posts");
}
