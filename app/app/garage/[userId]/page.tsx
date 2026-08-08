import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function carEmoji(make: string, assetType = "vehicle") {
  if (assetType === "trailer") return "🚚";
  if (assetType === "riding_mower") return "🚜";
  if (assetType === "equipment") return "🧰";
  const m = make.toLowerCase();
  if (m === "ford") return "🐎";
  if (m === "jeep") return "🚙";
  if (m === "chevy" || m === "chevrolet") return "🏁";
  if (m === "dodge") return "🐏";
  if (m === "toyota") return "🟦";
  if (m === "honda") return "🔵";
  return "🚗";
}

export default async function GaragePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const session = await requireSession();

  // Own garage → go home
  if (userId === session.userId) redirect("/dashboard");

  // Must have an accepted connection
  const connection = await (prisma as any).connection.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: session.userId },
        { requesterId: session.userId, addresseeId: userId },
      ],
      status: "accepted",
    },
  });

  if (!connection) redirect("/friends?msg=no-connection");

  const accessLevel: "view" | "full" = connection.accessLevel === "full" ? "full" : "view";

  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!owner) redirect("/friends");

  const cars = await prisma.car.findMany({
    where: { userId },
    orderBy: { year: "asc" },
    include: {
      photos: { where: { isPrivate: false }, orderBy: { takenAt: "desc" }, take: 1 },
      jobs: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 2,
        include: { phases: { include: { tasks: true } } },
      },
      serviceRecords: {
        orderBy: { serviceDate: "desc" },
        take: 1,
      },
    },
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/friends" className="text-gray-400 text-lg">←</Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold truncate">
              🚗 {owner.name ?? owner.email}&apos;s Garage
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {accessLevel === "full" ? "🔧 Full access" : "👁 View only"} · {cars.length} car{cars.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-6 space-y-4">
        {cars.length === 0 && (
          <div className="text-center text-gray-600 py-16 text-sm">No cars in this garage yet.</div>
        )}

        {cars.map((car) => {
          const photo = car.photos?.[0];
          const lastService = car.serviceRecords?.[0];

          return (
            <div key={car.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Car photo / header — click to go to detail */}
              <Link href={`/cars/${car.id}`}>
                {photo ? (
                  <div className="relative h-40 bg-gray-800">
                    <img
                      src={`/uploads/${photo.filename}`}
                      alt={`${car.year} ${car.make} ${car.model}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <div className="font-bold text-base text-white">
                        {carEmoji(car.make, car.assetType)} {car.year} {car.make} {car.model}
                      </div>
                      <div className="text-xs text-gray-300 flex gap-2 mt-0.5">
                        {car.color && <span>🎨 {car.color}</span>}
                        {car.mileage && <span>📍 {car.mileage.toLocaleString()} mi</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-800">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{carEmoji(car.make, car.assetType)}</span>
                      <div>
                        <div className="font-bold text-base">{car.year} {car.make} {car.model}</div>
                        <div className="text-xs text-gray-400 flex gap-2 flex-wrap">
                          {car.color && <span>🎨 {car.color}</span>}
                          {car.mileage && <span>📍 {car.mileage.toLocaleString()} mi</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-gray-600 text-sm">→</span>
                  </div>
                )}
              </Link>

              {/* Chips */}
              <div className="flex gap-2 px-3 pt-2 flex-wrap">
                {car.jobs.length > 0 && (
                  <span className="text-xs bg-amber-900/40 text-amber-300 border border-amber-700/40 px-2 py-0.5 rounded-full">
                    🔧 {car.jobs.length} active
                  </span>
                )}
                {lastService && (
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                    🛠 Last: {new Date(lastService.serviceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                )}
              </div>

              {/* Active jobs */}
              {car.jobs.length > 0 && (
                <div className="p-3 space-y-2">
                  {car.jobs.map((job) => {
                    const total = job.phases.reduce((s, ph) => s + ph.tasks.length, 0);
                    const done = job.phases.reduce((s, ph) => s + ph.tasks.filter((t) => t.done).length, 0);
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <Link key={job.id} href={`/job/${job.id}`}>
                        <div className="bg-gray-800 rounded-xl p-3 active:scale-[0.98] transition-transform">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="font-medium text-sm truncate">{job.title}</div>
                            <div className="text-base font-bold flex-shrink-0">{pct}%</div>
                          </div>
                          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all bg-amber-400" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
