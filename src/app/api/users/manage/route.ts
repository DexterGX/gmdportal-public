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
    role?:
      | "ADMIN"
      | "SALES"
      | "OFFICE"
      | "FINANCE"
      | "SPECIALIST"
      | "UNASSIGNED";
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

export async function DELETE(req: Request) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  // Only active admins can delete users
  if (!user || appRole !== "admin" || !isActive) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const { userId } = body as { userId: string };

  if (!userId) {
    return new NextResponse("Missing userId", { status: 400 });
  }

  // Prevent admins from deleting themselves
  if (userId === user.id) {
    return new NextResponse("Cannot delete your own account", { status: 400 });
  }

  try {
    await prisma.user.delete({
      where: { id: userId },
    });

    return new NextResponse("User deleted successfully", { status: 200 });
  } catch (error) {
    console.error("Error deleting user:", error);
    return new NextResponse("Failed to delete user", { status: 500 });
  }
}
