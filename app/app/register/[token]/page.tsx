import { prisma } from "@/lib/prisma";
import RegisterForm from "./RegisterForm";
import Link from "next/link";
import Glyph from "@/app/components/Glyph";

export const dynamic = "force-dynamic";

function carEmoji(make: string) {
  const m = make.toLowerCase();
  if (m.includes("trailer")) return "🚚";
  return "🚗";
}

const FEATURES = [
  { icon: "🚗", title: "Vehicle Management", desc: "Cars, trucks, trailers, equipment — all in one place" },
  { icon: "🔧", title: "Repair Job Tracker", desc: "Kanban board with phases, tasks & photo docs per job" },
  { icon: "🛠️", title: "Service History", desc: "Log every visit with cost, vendor, mileage & receipts" },
  { icon: "📄", title: "Document Storage", desc: "Registration, title, insurance, financing — all stored safely" },
  { icon: "🛡️", title: "Warranty Tracking", desc: "Line-item warranty alerts before they expire" },
  { icon: "🤝", title: "Garage Sharing", desc: "Invite friends with view or full access to your garage" },
];

export default async function RegisterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await (prisma as any).invite.findUnique({ where: { token } });

  const now = new Date();
  const invalid = !invite || invite.usedById || new Date(invite.expiresAt) < now;

  if (invalid) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-gray-900 border border-red-800 rounded-2xl p-6 text-center space-y-3">
          <div className="text-4xl"><Glyph e="🔒" /></div>
          <h1 className="text-xl font-bold">Invalid Invite</h1>
          <p className="text-sm text-gray-400">This link is invalid, already used, or expired.</p>
          <Link href="/login" className="block text-sm text-amber-400 underline">Go to login →</Link>
        </div>
      </div>
    );
  }

  // Load inviter info — only safe public fields, NO VIN/license/finance data
  const inviter = invite.createdById
    ? await prisma.user.findUnique({
        where: { id: invite.createdById },
        select: { name: true },
      })
    : null;

  const inviterCars = invite.createdById
    ? await prisma.car.findMany({
        where: { userId: invite.createdById },
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          photos: {
            where: { isFeatured: true, isPrivate: false },
            take: 1,
            select: { filename: true },
          },
        },
        take: 4,
        orderBy: { createdAt: "desc" },
      })
    : [];

  const inviterJobCount = invite.createdById
    ? await prisma.job.count({ where: { userId: invite.createdById } })
    : 0;

  const inviterName = inviter?.name ?? "Someone";
  const firstName = inviterName.split(" ")[0];
  const heroPhoto = inviterCars.find((c) => c.photos[0])?.photos[0];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col pb-10">

      {/* ── Hero ── */}
      <div className="relative bg-gray-900 border-b border-gray-800 px-5 pt-10 pb-8 text-center">
        {heroPhoto && (
          <div className="absolute inset-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/uploads/${heroPhoto.filename}`}
              alt=""
              className="w-full h-full object-cover opacity-10 blur-md scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 to-gray-900" />
          </div>
        )}

        <div className="relative z-10 space-y-3">
          <div className="text-5xl"><Glyph e="🏠" /></div>
          <div>
            <h1 className="text-2xl font-bold leading-snug">GarageMeet</h1>
            <p className="text-sm text-gray-400 mt-1">
              <span className="text-amber-400 font-semibold">{firstName}</span> invited you to join
            </p>
          </div>

          {/* Inviter's cars */}
          {inviterCars.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center pt-1">
              {inviterCars.map((car) => (
                <span key={car.id} className="inline-flex items-center gap-1 bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-full text-xs text-gray-300">
                  <Glyph e={carEmoji(car.make)} /> {car.year} {car.make} {car.model}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2 justify-center text-xs pt-1">
            <span className="bg-gray-800/80 px-3 py-1 rounded-full text-gray-400">
              <Glyph e="🚗" /> {inviterCars.length} car{inviterCars.length !== 1 ? "s" : ""}
            </span>
            <span className="bg-gray-800/80 px-3 py-1 rounded-full text-gray-400">
              <Glyph e="🔧" /> {inviterJobCount} job{inviterJobCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ── Feature highlights ── */}
      <div className="px-5 pt-7 pb-2 max-w-lg mx-auto w-full">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">What you get</p>
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-1">
              <div className="text-xl"><Glyph e={f.icon} /></div>
              <div className="text-xs font-bold text-white">{f.title}</div>
              <div className="text-xs text-gray-500 leading-snug">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="px-5 pt-6 max-w-sm w-full mx-auto space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-center">
          <p className="text-sm text-amber-300 font-medium">Free to use · No credit card · Guest mode available</p>
        </div>

        {/* Primary CTA */}
        <div className="space-y-2">
          <RegisterForm token={token} restrictedEmail={invite.email} />
        </div>

        <div className="relative flex items-center">
          <div className="flex-1 border-t border-gray-800" />
          <span className="px-3 text-xs text-gray-600">or</span>
          <div className="flex-1 border-t border-gray-800" />
        </div>

        <div className="flex gap-2">
          <Link
            href="/login"
            className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-200 font-semibold text-sm text-center active:bg-gray-700"
          >
            Sign in
          </Link>
          <Link
            href={`/guest?token=${token}`}
            className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-semibold text-sm text-center active:bg-gray-700"
          >
            <Glyph e="👀" /> Browse as guest
          </Link>
        </div>

        <p className="text-xs text-center text-gray-600">
          Guest mode lets you explore and add your own data before committing.
        </p>
      </div>
    </div>
  );
}
