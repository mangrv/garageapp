"use server";

import { prisma } from "@/lib/prisma";
import { signToken, COOKIE_NAME } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { trackServerMatomoEvent } from "@/lib/matomo-server";

function safeNext(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/login") || value.startsWith("/register") || value.startsWith("/api/")) return "/dashboard";
  return value;
}

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;
  const rememberMe = formData.get("rememberMe") === "on";
  const next = safeNext(formData.get("next"));

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "Invalid email or password" };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { error: "Invalid email or password" };

  void trackServerMatomoEvent({ category: "Account", action: "login", name: "email", userId: user.id, path: "/login" });
  const token = await signToken({ userId: user.id, email: user.email, name: user.name, role: (user as any).role ?? "user" });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...(rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}),
    path: "/",
  });

  redirect(next);
}
