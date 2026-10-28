import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Avatar from "@/app/components/Avatar";
import { getSession } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import ConnectButton from "./ConnectButton";
import Glyph from "@/app/components/Glyph";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const user = await (prisma.user as any).findFirst({
    where: { username: username.toLowerCase(), isPublic: true },
    select: { name: true, username: true, publicBio: true, _count: { select: { cars: { where: { isPublic: true } } } } },
  }).catch(() => null);
  if (!user) return { title: "Garage not found", robots: { index: false } };
  const who = user.name || `@${user.username}`;
  const count = user._count?.cars ?? 0;
  const title = `${who}'s garage`;
  const description = user.publicBio
    ? String(user.publicBio).slice(0, 155)
    : `${who} shares ${count} ${count === 1 ? "vehicle" : "vehicles"} on GarageMeet — builds, service history and projects.`;
  const path = `/u/${user.username}`;
  return { title, description, alternates: { canonical: path }, openGraph: { title: `${title} · GarageMeet`, description, url: path, type: "profile" } };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const session = await getSession();
  const viewerId = session?.userId ?? null;

  const user = await (prisma.user as any).findFirst({
    where: { username: username.toLowerCase(), isPublic: true },
    include: {
      cars: {
        where: { isPublic: true } as any,
        orderBy: { year: "desc" },
        include: {
          photos: { where: { isFeatured: true, isPrivate: false }, take: 1, select: { filename: true } },
          serviceRecords: { select: { id: true }, take: 1 },
          jobs: { where: { status: "done" }, select: { id: true } },
        },
      },
    },
  }) as any;

  if (!user) notFound();

  // Determine connection status between viewer and profile owner
  type ConnStatus = "none" | "pending_sent" | "pending_received" | "accepted" | "self";
  let connectionStatus: ConnStatus = "none";
  if (viewerId) {
    if (viewerId === user.id) {
      connectionStatus = "self";
    } else {
      const conn = await prisma.connection.findFirst({
        where: {
          OR: [
            { requesterId: viewerId, addresseeId: user.id },
            { requesterId: user.id, addresseeId: viewerId },
          ],
        },
      });
      if (conn) {
        if (conn.status === "accepted") connectionStatus = "accepted";
        else if (conn.status === "pending" && conn.requesterId === viewerId) connectionStatus = "pending_sent";
        else if (conn.status === "pending" && conn.addresseeId === viewerId) connectionStatus = "pending_received";
      }
    }
  }

  const profileUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/u/${username}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(profileUrl)}&bgcolor=ffffff&color=2446F0&margin=12`;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700">
        <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar placeholder */}
          <Avatar name={user.name ?? username} seed={username} size={88} />

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold">{user.name ?? username}</h1>
            <p className="text-gray-400 text-sm mt-0.5">@{username}</p>
            {user.publicBio && (
              <p className="text-gray-300 text-sm mt-2 max-w-md">{user.publicBio}</p>
            )}
            <p className="text-xs text-gray-600 mt-2 mb-3">
              {user.cars.length} {user.cars.length === 1 ? "vehicle" : "vehicles"} in garage
            </p>
            <ConnectButton
              username={username}
              initialStatus={connectionStatus}
              isLoggedIn={!!viewerId}
            />
          </div>

          {/* QR */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR code" width={80} height={80} className="rounded-lg" />
            <span className="text-[11px] text-gray-500">Scan to share</span>
          </div>
        </div>
      </div>

      {/* Cars grid */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        {user.cars.length === 0 ? (
          <p className="text-center text-gray-600 py-12">No public vehicles yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {user.cars.map((car: any) => {
              const photo = car.photos[0]?.filename ? `/uploads/${car.photos[0].filename}` : null;
              const cardUrl = `/u/${username}/car/${car.id}`;
              return (
                <Link
                  key={car.id}
                  href={cardUrl}
                  className="group relative rounded-2xl overflow-hidden border border-gray-800 hover:border-amber-500/50 transition-colors bg-gray-900"
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt={`${car.year} ${car.make} ${car.model}`}
                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-5xl">
                      <Glyph e="🚗" />
                    </div>
                  )}
                  <div className="p-4">
                    <h2 className="font-bold text-white text-lg leading-tight">
                      {car.year} {car.make} {car.model}
                    </h2>
                    {car.trim && <p className="text-xs text-amber-400 mt-0.5">{car.trim}</p>}
                    {car.color && <p className="text-xs text-gray-500 mt-0.5">{car.color}</p>}
                    <div className="flex gap-3 mt-2 text-xs text-gray-600">
                      {car.mileage && <span>{car.mileage.toLocaleString()} mi</span>}
                      {car.jobs.length > 0 && <span>{car.jobs.length} completed jobs</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto px-6 pb-12 text-center">
        <p className="text-xs text-gray-700">
          Powered by <span className="text-amber-500/60">GarageMeet</span>
        </p>
      </div>
    </div>
  );
}
