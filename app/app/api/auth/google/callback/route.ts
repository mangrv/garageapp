import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, COOKIE_NAME } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const OAUTH_STATE_COOKIE = "garage_oauth_state";

export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(new URL("/login?error=google_not_configured", req.url));
    }

    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    if (!code || !state) {
      return NextResponse.redirect(new URL("/login?error=google_missing_code", req.url));
    }

    const stateCookieRaw = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
    if (!stateCookieRaw) {
      return NextResponse.redirect(new URL("/login?error=google_invalid_state", req.url));
    }

    let stateCookie: { state: string; returnTo?: string; inviteToken?: string } | null = null;
    try {
      stateCookie = JSON.parse(stateCookieRaw);
    } catch {
      return NextResponse.redirect(new URL("/login?error=google_invalid_state", req.url));
    }

    if (!stateCookie || stateCookie.state !== state) {
      return NextResponse.redirect(new URL("/login?error=google_state_mismatch", req.url));
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL("/login?error=google_token_exchange_failed", req.url));
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL("/login?error=google_no_access_token", req.url));
    }

    const profileRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileRes.ok) {
      return NextResponse.redirect(new URL("/login?error=google_profile_failed", req.url));
    }

    const profile = (await profileRes.json()) as {
      email?: string;
      name?: string;
      email_verified?: boolean;
    };

    if (!profile.email || !profile.email_verified) {
      return NextResponse.redirect(new URL("/login?error=google_email_not_verified", req.url));
    }

    const email = profile.email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });
    const isNewUser = !user;

    // Handle invite token if present
    const inviteToken = stateCookie.inviteToken;
    let invite: any = null;
    if (inviteToken) {
      invite = await (prisma as any).invite.findUnique({ where: { token: inviteToken } });
      // Validate invite is still good
      if (!invite || invite.usedById || new Date(invite.expiresAt) < new Date()) {
        invite = null;
      }
    }

    if (!user) {
      const randomPasswordHash = await bcrypt.hash(randomUUID(), 12);
      user = await prisma.user.create({
        data: {
          id: randomUUID(),
          email,
          name: profile.name?.trim() || null,
          passwordHash: randomPasswordHash,
        } as any,
      });
    } else if (!user.name && profile.name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: profile.name.trim() },
      });
    }

    // Claim invite — mark used and create connection with inviter
    if (invite && !invite.usedById) {
      await (prisma as any).invite.update({
        where: { id: invite.id },
        data: { usedById: user.id, usedAt: new Date() },
      });
      // Auto-connect the new user with the inviter (bidirectional)
      if (invite.inviterId && invite.inviterId !== user.id) {
        const existing = await prisma.connection.findFirst({
          where: {
            OR: [
              { requesterId: invite.inviterId, addresseeId: user.id },
              { requesterId: user.id, addresseeId: invite.inviterId },
            ],
          },
        });
        if (!existing) {
          await prisma.connection.create({
            data: {
              requesterId: invite.inviterId,
              addresseeId: user.id,
              status: "accepted",
            },
          });
        }
      }
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: (user as any).role ?? "user",
    });

    // New users go to onboarding to set up their AI key
    const safeReturnTo = isNewUser
      ? "/onboarding"
      : (stateCookie.returnTo && stateCookie.returnTo.startsWith("/") && !stateCookie.returnTo.startsWith("//") && !stateCookie.returnTo.startsWith("/api/") ? stateCookie.returnTo : "/dashboard");
    const appBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_BASE_URL || req.nextUrl.origin;
    const res = NextResponse.redirect(new URL(safeReturnTo, appBaseUrl));
    res.cookies.delete(OAUTH_STATE_COOKIE);
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.redirect(new URL("/login?error=google_callback_crash", req.url));
  }
}
