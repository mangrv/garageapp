/**
 * sharedAccess.ts
 * Helpers to check if the current user can read/write another user's car.
 *
 * Rules:
 *  - Owner always has full access
 *  - Connected users have the accessLevel from their Connection row (view | full)
 *  - Everyone else: denied
 */

import { prisma } from "@/lib/prisma";

export type AccessLevel = "none" | "view" | "full";

/**
 * Returns the access level the actor has on a car owned by ownerId.
 */
export async function getCarAccessLevel(actorId: string, ownerId: string): Promise<AccessLevel> {
  if (actorId === ownerId) return "full";

  // Check both directions — either person may have initiated the connection
  const conn = await prisma.connection.findFirst({
    where: {
      OR: [
        { requesterId: ownerId, addresseeId: actorId },
        { requesterId: actorId, addresseeId: ownerId },
      ],
      status: "accepted",
    },
    select: { accessLevel: true },
  } as any);

  if (!conn) return "none";
  return (conn as any).accessLevel === "full" ? "full" : "view";
}

/**
 * Asserts read access (view or full). Throws if denied.
 */
export async function requireReadAccess(actorId: string, ownerId: string) {
  const level = await getCarAccessLevel(actorId, ownerId);
  if (level === "none") throw new Error("forbidden");
}

/**
 * Asserts write access (full only). Throws if denied.
 */
export async function requireWriteAccess(actorId: string, ownerId: string) {
  const level = await getCarAccessLevel(actorId, ownerId);
  if (level !== "full") throw new Error("forbidden");
}
