import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApiKey, normalizeScopes } from "@/lib/apiKeys";
import { apiKeySelect, requireAdmin } from "./shared";

const prismaAny = prisma as any;

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const keys = await prismaAny.apiKey.findMany({
      select: apiKeySelect,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ keys });
  } catch (error: any) {
    console.error("Failed to load API keys", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load API keys" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
    const scopes = normalizeScopes(body?.scopes);

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!scopes.some((scope) => scope !== "pricing:read")) {
      return NextResponse.json(
        { error: "Pick at least one program the key can read" },
        { status: 400 },
      );
    }

    let expiresAt: Date | null = null;
    if (body?.expiresAt) {
      const parsed = new Date(body.expiresAt);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "Expiration date must be in the future" },
          { status: 400 },
        );
      }
      expiresAt = parsed;
    }

    const { key, keyHash, keyPrefix } = generateApiKey();

    const created = await prismaAny.apiKey.create({
      data: {
        name,
        notes: notes || null,
        scopes,
        expiresAt,
        keyHash,
        keyPrefix,
        createdById: auth.user.id,
      },
      select: apiKeySelect,
    });

    // The full key is returned exactly once — only its hash is stored.
    return NextResponse.json({ key: created, secret: key }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create API key", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create API key" },
      { status: 500 },
    );
  }
}
