import "server-only";
import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { API_SCOPES, API_SCOPE_IDS, type ApiScope } from "@/lib/apiScopes";

const prismaAny = prisma as any;

export { API_SCOPES, API_SCOPE_IDS };
export type { ApiScope };

const KEY_PREFIX = "gmd_live_";

export function generateApiKey() {
  const secret = randomBytes(32).toString("base64url");
  const key = `${KEY_PREFIX}${secret}`;
  return {
    key,
    keyHash: hashApiKey(key),
    // Enough to recognize the key in a list without revealing it.
    keyPrefix: key.slice(0, KEY_PREFIX.length + 6),
  };
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function normalizeScopes(input: unknown): ApiScope[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<string>(API_SCOPE_IDS);
  return Array.from(
    new Set(
      input
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => allowed.has(value)),
    ),
  ) as ApiScope[];
}

function extractKey(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (match) return match[1].trim();
  const headerKey = request.headers.get("x-api-key");
  return headerKey ? headerKey.trim() : "";
}

function apiError(status: number, error: string) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export type ApiKeyContext = {
  id: string;
  name: string;
  scopes: ApiScope[];
  includePricing: boolean;
};

/**
 * Validates the API key on an incoming /api/v1 request and checks it carries
 * the required scope. Returns either the key context or a ready-to-return
 * error response.
 */
export async function authenticateApiKey(
  request: Request,
  requiredScope: ApiScope | null,
): Promise<{ key: ApiKeyContext; error: null } | { key: null; error: NextResponse }> {
  const rawKey = extractKey(request);
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) {
    return {
      key: null,
      error: apiError(401, "Missing or invalid API key. Send it as 'Authorization: Bearer <key>'."),
    };
  }

  const record = await prismaAny.apiKey.findUnique({
    where: { keyHash: hashApiKey(rawKey) },
  });

  if (!record || !record.isActive) {
    return { key: null, error: apiError(401, "API key is invalid or has been revoked.") };
  }

  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    return { key: null, error: apiError(401, "API key has expired.") };
  }

  const scopes = normalizeScopes(record.scopes);
  if (requiredScope && !scopes.includes(requiredScope)) {
    return {
      key: null,
      error: apiError(403, `This API key does not have the '${requiredScope}' scope.`),
    };
  }

  // Usage tracking is best-effort — never block the request on it.
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const ip = forwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  prismaAny.apiKey
    .update({
      where: { id: record.id },
      data: { lastUsedAt: new Date(), lastUsedIp: ip, usageCount: { increment: 1 } },
    })
    .catch((err: unknown) => console.error("Failed to record API key usage", err));

  return {
    key: {
      id: record.id,
      name: record.name,
      scopes,
      includePricing: scopes.includes("pricing:read"),
    },
    error: null,
  };
}

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function apiBadRequest(message: string) {
  return apiError(400, message);
}

export function apiNotFound(message = "Not found") {
  return apiError(404, message);
}

export function apiServerError(err: unknown, context: string) {
  console.error(`[api/v1] ${context}`, err);
  return apiError(500, "Internal server error");
}

/** Parses ?limit= (default 50, max 200). */
export function parseLimit(value: string | null, fallback = 50, max = 200) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

/** Parses an ISO date query param; returns undefined when absent, null when invalid. */
export function parseDateParam(value: string | null): Date | undefined | null {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Decimal/number/null → number|null, for JSON output. */
export function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
