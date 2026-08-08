import { prisma } from "@/lib/prisma";
import TemplatesClient from "./TemplatesClient";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  let templates: Awaited<ReturnType<typeof prisma.userTemplate.findMany>> = [];
  try {
    templates = await prisma.userTemplate.findMany({ orderBy: { createdAt: "desc" } });
  } catch {
    // Table may not exist yet — migrations will create it on first run
  }

  return (
    <TemplatesClient
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt.toISOString(),
        phaseCount: (() => { try { return JSON.parse(t.phasesJson).length; } catch { return 0; } })(),
        taskCount: (() => { try { return JSON.parse(t.phasesJson).reduce((s: number, p: any) => s + (p.tasks?.length ?? 0), 0); } catch { return 0; } })(),
      }))}
    />
  );
}
