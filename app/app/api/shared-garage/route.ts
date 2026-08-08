import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * GET /api/shared-garage
 * Returns garages that other users have shared with the current user via an accepted Connection.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find all accepted connections where current user is the addressee (invited by someone else)
  const connections = await prisma.connection.findMany({
    where: {
      addresseeId: session.userId,
      status: "accepted",
    },
    include: {
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  } as any);

  // For each connection, fetch the owner's cars
  const sharedGarages = await Promise.all(
    connections.map(async (conn: any) => {
      const cars = await prisma.car.findMany({
        where: { userId: conn.requesterId },
        orderBy: { createdAt: "desc" },
      });
      return {
        owner: conn.requester,
        accessLevel: conn.accessLevel ?? "view",
        cars,
      };
    })
  );

  // Filter out owners with no cars
  return NextResponse.json({ sharedGarages: sharedGarages.filter((g: any) => g.cars.length > 0) });
}
