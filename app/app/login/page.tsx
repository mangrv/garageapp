import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to GarageMeet to see your vehicles, service records, receipts and repair projects.",
  alternates: { canonical: "/login" },
  openGraph: { title: "Sign in · GarageMeet", url: "/login" },
};

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
