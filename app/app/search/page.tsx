import { prisma } from "@/lib/prisma";
import Link from "next/link";
import SearchBar from "./SearchBar";
import { requireSession } from "@/lib/session";

function highlight(text: string, q: string) {
  if (!q || !text) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return text.slice(0, idx) + "【" + text.slice(idx, idx + q.length) + "】" + text.slice(idx + q.length);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [cars, projects, tasks, serviceRecords] = query.length < 2
    ? [[], [], [], []]
    : await Promise.all([
        prisma.car.findMany({
          where: {
            userId: session.userId,
            OR: [
              { make: { contains: query } },
              { model: { contains: query } },
              { trim: { contains: query } },
              { color: { contains: query } },
              { notes: { contains: query } },
            ],
          },
          take: 10,
        }),
        prisma.job.findMany({
          where: {
            userId: session.userId,
            OR: [
              { title: { contains: query } },
              { notes: { contains: query } },
            ],
          },
          include: { car: true },
          take: 10,
        }),
        prisma.task.findMany({
          where: {
            OR: [
              { title: { contains: query } },
              { tip: { contains: query } },
              { warning: { contains: query } },
              { comments: { some: { text: { contains: query } } } },
            ],
          },
          include: { phase: { include: { job: { include: { car: true } } } } },
          take: 10,
        }),
        prisma.serviceRecord.findMany({
          where: {
            OR: [
              { title: { contains: query } },
              { notes: { contains: query } },
            ],
          },
          include: { car: true },
          take: 10,
        }),
      ]);

  const totalResults = cars.length + projects.length + tasks.length + serviceRecords.length;

  return (
    <div className="min-h-screen bg-gray-950 pb-24 w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/dashboard" className="text-gray-400 text-sm">←</Link>
          <h1 className="font-bold text-base">🔍 Search</h1>
        </div>
        <SearchBar defaultValue={query} />
      </header>

      <div className="px-4 pt-4 space-y-6">
        {query.length < 2 ? (
          <p className="text-center text-sm text-gray-600 pt-8">Type at least 2 characters to search</p>
        ) : totalResults === 0 ? (
          <p className="text-center text-sm text-gray-600 pt-8">No results for "{query}"</p>
        ) : (
          <>
            {/* Cars */}
            {cars.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">🚗 Cars ({cars.length})</h2>
                <div className="space-y-2">
                  {cars.map((car) => (
                    <Link key={car.id} href={`/cars/${car.id}`}>
                      <div className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 active:scale-[0.98] transition-transform">
                        <div className="font-medium text-sm">{car.year} {car.make} {car.model} {car.trim}</div>
                        {car.color && <div className="text-xs text-gray-500 mt-0.5">🎨 {car.color}</div>}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Jobs */}
            {projects.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">🔧 Jobs ({projects.length})</h2>
                <div className="space-y-2">
                  {projects.map((p) => {
                    const carLabel = p.car ? `${p.car.year} ${p.car.make} ${p.car.model}` : null;
                    return (
                      <Link key={p.id} href={`/job/${p.id}`}>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 active:scale-[0.98] transition-transform">
                          <div className="font-medium text-sm">{p.title}</div>
                          <div className="flex gap-2 mt-0.5 text-xs text-gray-500">
                            {carLabel && <span>{carLabel}</span>}
                            <span className="capitalize">{p.status}</span>
                          </div>
                          {p.notes && <div className="text-xs text-gray-600 mt-1 truncate">{p.notes}</div>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Tasks */}
            {tasks.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">✅ Tasks ({tasks.length})</h2>
                <div className="space-y-2">
                  {tasks.map((t) => {
                    const job = t.phase.job;
                    const carLabel = job.car ? `${job.car.year} ${job.car.make} ${job.car.model}` : null;
                    return (
                      <Link key={t.id} href={`/job/${job.id}`}>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 active:scale-[0.98] transition-transform">
                          <div className={`font-medium text-sm ${t.done ? "line-through text-gray-500" : ""}`}>{t.title}</div>
                          <div className="flex gap-2 mt-0.5 text-xs text-gray-500">
                            <span>{job.title}</span>
                            {carLabel && <span>· {carLabel}</span>}
                            <span>· {t.phase.title}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Service records */}
            {serviceRecords.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">🛠 Service Records ({serviceRecords.length})</h2>
                <div className="space-y-2">
                  {serviceRecords.map((r) => {
                    const carLabel = `${r.car.year} ${r.car.make} ${r.car.model}`;
                    return (
                      <Link key={r.id} href={`/cars/${r.car.id}/service-history`}>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 active:scale-[0.98] transition-transform">
                          <div className="font-medium text-sm">{r.title}</div>
                          <div className="flex gap-2 mt-0.5 text-xs text-gray-500">
                            <span>{carLabel}</span>
                            <span>· {new Date(r.serviceDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                            {r.mileage && <span>· {r.mileage.toLocaleString()} mi</span>}
                          </div>
                          {r.notes && <div className="text-xs text-gray-600 mt-1 truncate">{r.notes}</div>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
