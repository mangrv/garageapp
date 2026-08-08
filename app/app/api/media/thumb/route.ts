import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const video = req.nextUrl.searchParams.get("video") || "";
  const safeVideo = decodeURIComponent(video).replace(/\.\./g, "").replace(/^\//, "");
  if (!safeVideo) return NextResponse.json({ error: "Missing video" }, { status: 400 });

  // Delegate to hardened uploads route for auth + ownership + local/S3 behavior
  const target = new URL(`/uploads/${safeVideo}.thumb.webp`, req.url);
  return NextResponse.redirect(target, { status: 307 });
}
