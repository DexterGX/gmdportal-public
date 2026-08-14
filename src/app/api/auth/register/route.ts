import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const prismaAny = prisma as any;

// Max registration attempts (successful, blocked, or bot-detected) allowed
// from a single IP within the rolling window below.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 5;
// Real users take at least this long to fill out the form after it loads.
const MIN_FORM_FILL_MS = 1200;
// Prune attempt rows older than this so the table doesn't grow unbounded.
const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

async function recordAttempt(ip: string) {
  if (!prismaAny.registrationAttempt) return; // schema not migrated yet
  try {
    await prismaAny.registrationAttempt.create({ data: { ip } });
    // Opportunistic cleanup — cheap thanks to the (ip, createdAt) index.
    await prismaAny.registrationAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - ATTEMPT_RETENTION_MS) } },
    });
  } catch {
    // Never let rate-limit bookkeeping break registration.
  }
}

async function isRateLimited(ip: string): Promise<boolean> {
  if (!prismaAny.registrationAttempt) return false; // schema not migrated yet
  try {
    const count = await prismaAny.registrationAttempt.count({
      where: { ip, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } },
    });
    return count >= RATE_LIMIT_MAX_ATTEMPTS;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { name, email, username, password, hpWebsite, elapsedMs } = await req.json();
    const ip = getClientIp(req);

    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 },
      );
    }

    // Bot signals: the honeypot field was filled in, or the form was
    // submitted implausibly fast. Log the attempt (it still counts toward
    // the IP's rate limit) but respond as if registration succeeded so the
    // bot has no signal to adapt against — no account is actually created.
    const isBot =
      (typeof hpWebsite === "string" && hpWebsite.trim() !== "") ||
      (typeof elapsedMs === "number" && elapsedMs < MIN_FORM_FILL_MS);
    if (isBot) {
      await recordAttempt(ip);
      return NextResponse.json({ message: "User registered successfully" });
    }

    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await recordAttempt(ip);

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        username,
        passwordHash: hashedPassword,
      },
      select: { id: true, name: true, email: true, username: true },
    });

    return NextResponse.json({ message: "User registered successfully", user });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
