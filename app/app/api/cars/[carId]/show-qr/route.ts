import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { carId } = await params;

  const car = await prisma.car.findFirst({
    where: { id: carId, userId: session.userId },
    select: { year: true, make: true, model: true, trim: true, color: true },
  });
  if (!car) return new NextResponse("Not found", { status: 404 });

  const user = await (prisma.user as any).findUnique({
    where: { id: session.userId },
    select: { username: true, name: true },
  }) as any;

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://garage.jorgeiglesias.com";
  const cardUrl = user?.username
    ? `${base}/u/${user.username}/car/${carId}`
    : `${base}/car/${carId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(cardUrl)}&bgcolor=ffffff&color=000000&margin=20`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${car.year} ${car.make} ${car.model} — Show Card QR</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: white; color: black; }
    .page { width: 3.5in; padding: 0.25in; margin: 0 auto; text-align: center; }
    .year { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2px; }
    .make { font-size: 28px; font-weight: 900; line-height: 1; }
    .model { font-size: 18px; font-weight: 600; color: #d97706; }
    .trim { font-size: 12px; color: #999; margin-top: 2px; }
    .divider { border: none; border-top: 1px solid #eee; margin: 12px 0; }
    .qr { width: 180px; height: 180px; margin: 0 auto; display: block; }
    .scan { font-size: 10px; color: #999; margin-top: 8px; }
    .url { font-size: 9px; color: #ccc; margin-top: 2px; font-family: monospace; word-break: break-all; }
    @media print { @page { margin: 0.1in; } }
  </style>
</head>
<body onload="window.print()">
  <div class="page">
    <p class="year">${car.year}</p>
    <p class="make">${car.make}</p>
    <p class="model">${car.model}</p>
    ${car.trim ? `<p class="trim">${car.trim}</p>` : ""}
    ${car.color ? `<p class="trim">${car.color}</p>` : ""}
    <hr class="divider"/>
    <img class="qr" src="${qrUrl}" alt="QR Code"/>
    <p class="scan">Scan to view this car's full profile</p>
    <p class="url">${cardUrl}</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
