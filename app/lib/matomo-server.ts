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

    await fetch(`${base}?${params.toString()}`, { method: "GET", cache: "no-store" });
  } catch {
    // telemetry should never break app flow
  }
}
