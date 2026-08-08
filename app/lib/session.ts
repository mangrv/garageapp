import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "./auth";
import { redirect } from "next/navigation";

export type SessionUser = {
  userId: string;
  email: string;
  name: string | null;
  role: string;
};

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = await verifyToken(token);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: (payload.name as string) ?? null,
      role: (payload.role as string) ?? "user",
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
