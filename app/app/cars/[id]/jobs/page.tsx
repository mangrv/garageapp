import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { translations } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Wrench, Plus } from "lucide-react";
import JobListClient from "./JobListClient";

export default async function CarJobsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const car = await prisma.car.findFirst({
    where: { id },
    select: { id: true, year: true, make: true, model: true },
  });
  if (!car) redirect("/dashboard");

  const cookieStore = await cookies();
  const lang = (cookieStore.get("garage-lang")?.value ?? "en") as "en" | "es";
  const tr = translations[lang];

  const jobs = await (prisma.job as any).findMany({
    where: { carId: id },
    include: {
      phases: {
        include: { tasks: { select: { id: true, done: true } } },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  // Serialize for client component
  const serializedJobs = jobs.map((j: any) => ({
    id: j.id,
    title: j.title,
    notes: j.notes ?? null,
    status: j.status,
    sortOrder: j.sortOrder ?? 0,
    carId: j.carId ?? null,
    taskCount: j.phases.flatMap((p: any) => p.tasks).length,
    doneCount: j.phases.flatMap((p: any) => p.tasks).filter((t: any) => t.done).length,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Wrench size={18} className="text-gray-400" />
            {tr.jobs}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{car.year} {car.make} {car.model}</p>
        </div>
        <Link
          href={`/jobs/new?carId=${id}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-on-accent hover:bg-amber-400 transition-colors active:scale-95"
        >
          <Plus size={13} />
          {tr.newJob}
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-16">
          <Wrench size={40} className="mx-auto text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">{tr.noJobsYet}</p>
          <Link href={`/jobs/new?carId=${id}`} className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300">
            <Plus size={12} /> {tr.createFirstJob}
          </Link>
        </div>
      ) : (
        <JobListClient jobs={serializedJobs} carId={id} lang={lang} />
      )}
    </div>
  );
}
