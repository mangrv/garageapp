import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <OnboardingClient />;
}
