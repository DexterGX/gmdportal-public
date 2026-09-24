import { NextRequest } from "next/server";
import { apiJson, authenticateApiKey } from "@/lib/apiKeys";

export const dynamic = "force-dynamic";

// Lets an integrator confirm their key works and see what it can access.
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request, null);
  if (auth.error) return auth.error;

  return apiJson({
    ok: true,
    keyName: auth.key.name,
    scopes: auth.key.scopes,
    serverTime: new Date().toISOString(),
  });
}
