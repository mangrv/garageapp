import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { translations } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";

export default async function WarrantyPage({ params }: { params: Promise<{ id: string }> }) {
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

  const lineItems = await prisma.receiptLineItem.findMany({
    where: {
      receipt: { serviceRecord: { carId: id } },
      OR: [
        { warrantyProvider: { not: null } },
        { warrantyStart: { not: null } },
        { warrantyEnd: { not: null } },
        { warrantyNotes: { not: null } },
      ],
    },
    orderBy: { warrantyEnd: "asc" },
    select: {
      id: true,
      name: true,
      warrantyProvider: true,
      warrantyStart: true,
      warrantyEnd: true,
      warrantyNotes: true,
      receipt: { select: { id: true, serviceRecordId: true } },
    },
  });

  const now = Date.now();

  const withStatus = lineItems.map(w => {
    const endTs = w.warrantyEnd ? w.warrantyEnd.getTime() : null;
    const diffDays = endTs ? Math.floor((endTs - now) / (1000 * 60 * 60 * 24)) : null;
    const status = diffDays == null ? "active" : diffDays < 0 ? "expired" : diffDays <= 30 ? "soon" : "active";
    return { ...w, status, diffDays };
  });

  const active  = withStatus.filter(w => w.status === "active");
  const soon    = withStatus.filter(w => w.status === "soon");
  const expired = withStatus.filter(w => w.status === "expired");

  const badgeClass = { active: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40", soon: "bg-amber-900/40 text-amber-300 border-amber-700/40", expired: "bg-gray-800 text-gray-500 border-gray-700" };

  const Card = ({ w }: { w: typeof withStatus[0] }) => {
    const href = w.receipt?.serviceRecordId
      ? `/cars/${id}/service-history/${w.receipt.serviceRecordId}`
      : w.receipt?.id ? `/receipts/${w.receipt.id}` : "#";
    return (
      <Link href={href} className="block bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{w.name}</div>
            {w.warrantyProvider && <div className="text-xs text-gray-500 mt-0.5">{w.warrantyProvider}</div>}
            <div className="text-xs text-gray-400 mt-1.5 space-y-0.5">
              {w.warrantyStart && <div>{lang === "es" ? "Desde" : "From"} {w.warrantyStart.toLocaleDateString(lang === "es" ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
              {w.warrantyEnd && (
                <div>
                  {lang === "es" ? "Vence" : "Expires"} {w.warrantyEnd.toLocaleDateString(lang === "es" ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {w.diffDays != null && w.diffDays >= 0 && <span className="text-gray-500"> · {w.diffDays}{lang === "es" ? "d restantes" : "d left"}</span>}
                </div>
              )}
            </div>
            {w.warrantyNotes && <div className="text-xs text-gray-600 mt-1.5 italic">{w.warrantyNotes}</div>}
          </div>
          <span className={`flex-shrink-0 text-[10px] px-2 py-1 rounded-full border font-semibold ${badgeClass[w.status as keyof typeof badgeClass]}`}>
            {w.status === "expired" ? tr.warrantyExpired_ : w.status === "soon" ? tr.expiringSoon : tr.warrantyActive_}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield size={20} className="text-gray-400" />
        <div>
          <h1 className="text-lg font-bold text-white">{lang === "es" ? "Seguimiento de garantía" : "Warranty Tracker"}</h1>
          <p className="text-xs text-gray-500">{car.year} {car.make} {car.model} · {lineItems.length} {lang === "es" ? (lineItems.length === 1 ? "artículo" : "artículos") : `item${lineItems.length !== 1 ? "s" : ""}`}</p>
        </div>
      </div>

      {lineItems.length === 0 ? (
        <div className="text-center py-16">
          <Shield size={40} className="mx-auto text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">{lang === "es" ? "Sin artículos de garantía aún" : "No warranty items yet"}</p>
          <p className="text-xs text-gray-600 mt-1">{lang === "es" ? "Agrega detalles de garantía al registrar servicios o recibos" : "Add warranty details when logging service records or receipts"}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {soon.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-3">⚠ {lang === "es" ? "Vence pronto" : "Expiring Soon"} ({soon.length})</h2>
              <div className="space-y-2">{soon.map(w => <Card key={w.id} w={w} />)}</div>
            </div>
          )}
          {active.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3">{lang === "es" ? "Activo" : "Active"} ({active.length})</h2>
              <div className="space-y-2">{active.map(w => <Card key={w.id} w={w} />)}</div>
            </div>
          )}
          {expired.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{lang === "es" ? "Vencido" : "Expired"} ({expired.length})</h2>
              <div className="space-y-2">{expired.map(w => <Card key={w.id} w={w} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
