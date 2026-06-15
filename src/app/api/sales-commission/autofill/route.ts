import { NextResponse } from "next/server";
import { requireSalesCommissionAccess } from "@/lib/salesCommissionAuth";

export async function POST() {
  const access = await requireSalesCommissionAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  return NextResponse.json({
    connected: false,
    message:
      "QuickBooks autofill is not connected yet. Please import a Customer Report or enter values manually.",
  });
}
