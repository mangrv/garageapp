import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { cookies } from "next/headers";
import { translations } from "@/lib/i18n";
import { redirect } from "next/navigation";
import CarDocuments from "../CarDocuments";

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
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

  const documents = await (prisma as any).carDocument.findMany({
    where: { carId: id },
    orderBy: { createdAt: "desc" },
  });

  const docs = documents.map((d: any) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    expiresAt: d.expiresAt?.toISOString() ?? null,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white">{tr.navDocs}</h1>
        <p className="text-xs text-gray-500">{car.year} {car.make} {car.model}</p>
      </div>
      <CarDocuments carId={id} initialDocuments={docs} />
    </div>
  );
}
