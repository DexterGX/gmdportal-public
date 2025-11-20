import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

export async function POST(req: Request) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  // Only active admins can manage users
  if (!user || appRole !== "admin" || !isActive) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const { userId, role, active } = body as {
    userId: string;
    role?: "ADMIN" | "INVENTORY" | "SALES" | "VIEWER" | "UNASSIGNED";
    active?: boolean;
  };

  if (!userId) {
    return new NextResponse("Missing userId", { status: 400 });
  }

  const data: any = {};
  if (role) data.role = role;
  if (typeof active === "boolean") data.active = active;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, role: true, active: true },
  });

  return NextResponse.json(updated);
}
