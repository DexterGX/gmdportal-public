import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { setHiddenPriceListCategories } from "@/lib/fabricationPriceListVisibility";
import { FABRICATION_SETTINGS_CATEGORIES } from "@/lib/fabricationSettings";

export async function PUT(request: NextRequest) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const incoming: unknown[] = Array.isArray(body?.hiddenCategories)
      ? body.hiddenCategories
      : [];
    const validCategories = new Set(
      FABRICATION_SETTINGS_CATEGORIES.map((c) => c.category as string),
    );
    const cleaned = incoming.filter(
      (c): c is string => typeof c === "string" && validCategories.has(c),
    );

    const saved = await setHiddenPriceListCategories(cleaned);
    return NextResponse.json({ hiddenCategories: saved });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save." },
      { status: 500 },
    );
  }
}
