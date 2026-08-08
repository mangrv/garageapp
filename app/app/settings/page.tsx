import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await (prisma.user as any).findUnique({
    where: { id: session.userId },
    select: { name: true, displayName: true, email: true, aiModel: true, aiApiKey: true, username: true, publicBio: true, isPublic: true },
  }) as any;

  if (!user) redirect("/login");

  function maskKey(key: string): string {
    if (key.length <= 8) return "••••••••";
    return "••••••••••••" + key.slice(-4);
  }

  return (
    <SettingsClient
      name={user.name ?? ""}
      email={user.email}
      displayName={user.displayName ?? ""}
      aiModel={(user.aiModel as string) ?? "default"}
      aiApiKeySet={!!user.aiApiKey}
      aiApiKeyMasked={user.aiApiKey ? maskKey(user.aiApiKey as string) : null}
      username={user.username ?? ""}
      publicBio={user.publicBio ?? ""}
      isPublic={user.isPublic ?? false}
    />
  );
}
