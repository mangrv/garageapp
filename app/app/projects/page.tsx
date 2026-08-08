import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; carId?: string }>;
}) {
  let session;
  try { session = await requireSession(); } catch { redirect("/login"); }

  const { status = "active", carId = "" } = await searchParams;

  const whereStatus =
    status === "done" ? "done"
    : status === "archived" ? "archived"
    : "active";

  const jobs = await prisma.job.findMany({
    where: {
      userId: session.userId,
      status: whereStatus,
      ...(carId ? { carId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      car: { select: { id: true, year: true, make: true, model: true, color: true } },
      phases: {
        orderBy: { sortOrder: "asc" },
        include: { tasks: { select: { id: true, done: true } } },
      },
      receipts: { select: { id: true, totalAmount: true } },
    },
  });

  const cars = await prisma.car.findMany({
    where: { userId: session.userId },
    orderBy: { year: "desc" },
    select: { id: true, year: true, make: true, model: true },
  });

  const counts = {
    active: await prisma.job.count({ where: { userId: session.userId, status: "active" } }),
    done: await prisma.job.count({ where: { userId: session.userId, status: "done" } }),
    archived: await prisma.job.count({ where: { userId: session.userId, status: "archived" } }),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-sm text-gray-500 mt-0.5">{counts.active} active · {counts.done} done</p>
          </div>
          <Link
            href="/jobs/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition"
          >
            + New
          </Link>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1">
          {(["active", "done", "archived"] as const).map((s) => (
            <Link
              key={s}
              href={`/projects?status=${s}${carId ? `&carId=${carId}` : ""}`}
              className={`flex-1 text-center text-sm py-1.5 rounded-lg font-medium transition-colors capitalize ${
                status === s
                  ? "bg-white dark:bg-gray-800 text-foreground shadow-sm"
                  : "text-gray-500 hover:text-foreground"
              }`}
            >
              {s} {counts[s] > 0 && <span className="text-xs opacity-60">({counts[s]})</span>}
            </Link>
          ))}
        </div>

        {/* Car filter */}
        {cars.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <Link
              href={`/projects?status=${status}`}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                !carId
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent"
                  : "border-gray-300 dark:border-gray-700 text-gray-500 hover:text-foreground"
              }`}
            >
              All vehicles
            </Link>
            {cars.map((c) => (
              <Link
                key={c.id}
                href={`/projects?status=${status}&carId=${c.id}`}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                  carId === c.id
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent"
                    : "border-gray-300 dark:border-gray-700 text-gray-500 hover:text-foreground"
                }`}
              >
                {c.year} {c.make} {c.model}
              </Link>
            ))}
          </div>
        )}

        {/* Job list */}
        {jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">🔧</p>
            <p className="font-medium">No {status} projects</p>
            {status === "active" && (
              <Link href="/jobs/new" className="inline-block mt-4 text-sm text-amber-500 hover:underline">
                Start a new project →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const allTasks = job.phases.flatMap((p) => p.tasks);
              const doneTasks = allTasks.filter((t) => t.done).length;
              const totalTasks = allTasks.length;
              const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
              const totalPhases = job.phases.length;
              const donePhases = job.phases.filter((p) =>
                p.tasks.length > 0 && p.tasks.every((t) => t.done)
              ).length;
              const receiptTotal = job.receipts.reduce(
                (s, r) => s + (r.totalAmount ?? 0), 0
              );

              return (
                <Link
                  key={job.id}
                  href={`/job/${job.id}`}
                  className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 hover:border-amber-500/40 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-foreground truncate group-hover:text-amber-500 transition-colors">
                        {job.title}
                      </h2>
                      {job.car && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {job.car.year} {job.car.make} {job.car.model}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {receiptTotal > 0 && (
                        <p className="text-sm font-semibold text-amber-500">${receiptTotal.toFixed(2)}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(job.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  {totalTasks > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{donePhases}/{totalPhases} phases · {doneTasks}/{totalTasks} tasks</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            progress === 100 ? "bg-green-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* No tasks yet */}
                  {totalPhases === 0 && (
                    <p className="mt-2 text-xs text-gray-500">No phases yet</p>
                  )}
                  {totalPhases > 0 && totalTasks === 0 && (
                    <p className="mt-2 text-xs text-gray-500">{totalPhases} phases · no tasks yet</p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
