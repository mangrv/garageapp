export async function trackServerMatomoEvent(opts: {
  category: string;
  action: string;
  name?: string;
  value?: number;
  userId?: string;
  path?: string;
}) {
  try {
    const base = "https://analytics.jlikr.com/matomo.php";
    const params = new URLSearchParams({
      idsite: "34",
      rec: "1",
      apiv: "1",
      e_c: opts.category,
      e_a: opts.action,
      rand: Math.random().toString().slice(2),
      url: `https://garagemeet.com${opts.path ?? "/"}`,
    });
    if (opts.name) params.set("e_n", opts.name);
    if (typeof opts.value === "number") params.set("e_v", String(opts.value));
    if (opts.userId) params.set("uid", opts.userId);

    await fetch(`${base}?${params.toString()}`, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(3000) });
  } catch {
    // telemetry should never break app flow
  }
}

/**
 * Records vehicles a user just added: one `vehicle_added` per vehicle, plus a single
 * `first_vehicle_added` when these are the account's first vehicles.
 */
export async function trackVehiclesAdded(opts: { userId: string; added: number; name?: string; path: string }) {
  if (opts.added < 1) return;
  try {
    const { prisma } = await import("@/lib/prisma");
    const total = await prisma.car.count({ where: { userId: opts.userId } });
    for (let i = 0; i < opts.added; i++) {
      await trackServerMatomoEvent({ category: "Garage", action: "vehicle_added", name: opts.name, userId: opts.userId, path: opts.path });
    }
    if (total === opts.added) {
      await trackServerMatomoEvent({ category: "Garage", action: "first_vehicle_added", name: opts.name, userId: opts.userId, path: opts.path });
    }
  } catch {
    // telemetry should never break app flow
  }
}
