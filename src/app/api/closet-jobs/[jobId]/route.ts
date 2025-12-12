import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

type JobRouteContext = {
  params: Promise<{ jobId: string }>;
};

// GET /api/closet-jobs/[jobId] - Get a specific job with quotes
export async function GET(request: NextRequest, context: JobRouteContext) {
  try {
    const { jobId } = await context.params;
    const { user, appRole } = await getCurrentUserWithRole();

    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "sales", "installer"].includes(appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const job = await prisma.closetJob.findUnique({
      where: { id: jobId },
      include: {
        quotes: {
          include: {
            files: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // If user is INSTALLER, only show jobs where they are the installer
    if (appRole === "installer" && job.installerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error("Error fetching closet job:", error);
    return NextResponse.json(
      { error: "Failed to fetch closet job" },
      { status: 500 }
    );
  }
}

// PATCH /api/closet-jobs/[jobId] - Update job status or notes
export async function PATCH(request: NextRequest, context: JobRouteContext) {
  try {
    const { jobId } = await context.params;
    const { user, appRole } = await getCurrentUserWithRole();

    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "sales"].includes(appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { status, notesSales } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (notesSales !== undefined) updateData.notesSales = notesSales;

    const job = await prisma.closetJob.update({
      where: { id: jobId },
      data: updateData,
    });

    return NextResponse.json(job);
  } catch (error) {
    console.error("Error updating closet job:", error);
    return NextResponse.json(
      { error: "Failed to update closet job" },
      { status: 500 }
    );
  }
}
