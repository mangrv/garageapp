import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import CarSectionNav from "./CarSectionNav";
import { getCarAccessLevel } from "@/lib/sharedAccess";

export default async function CarLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  // Resolve car owner first (shared access allowed)
  const carOwner = await prisma.car.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!carOwner?.userId) redirect("/dashboard");

  const accessLevel = await getCarAccessLevel(session.userId, carOwner.userId);
  if (accessLevel === "none") redirect("/dashboard");

  // Load basic car label (no userId filter — access already validated)
  const car = await prisma.car.findUnique({
    where: { id },
    select: { id: true, year: true, make: true, model: true },
  });

  if (!car) redirect("/dashboard");

  const carName = `${car.year} ${car.make} ${car.model}`;

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky section nav — visible on all car sub-pages */}
      <CarSectionNav carId={id} carName={carName} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
