import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import LoginClient from "./LoginClient";

function safeNext(value?: string) {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/login") || value.startsWith("/register") || value.startsWith("/api/")) return "/dashboard";
  return value;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const session = await getSession();
  if (session) redirect(next);
  return <LoginClient next={next} />;
}
