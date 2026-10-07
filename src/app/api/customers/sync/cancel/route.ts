import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";

/**
 * Cancel a running sync job
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check - admin only
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getProgramUserContext("customersV2");
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Find the sync job
    const syncJob = await prisma.syncJob.findUnique({
      where: { id: jobId },
    });

    if (!syncJob) {
      return NextResponse.json(
        { error: "Sync job not found" },
        { status: 404 }
      );
    }

    if (syncJob.status !== "running") {
      return NextResponse.json(
        { error: `Cannot cancel job with status: ${syncJob.status}` },
        { status: 400 }
      );
    }

    // Mark for cancellation
    await prisma.syncJob.update({
      where: { id: jobId },
      data: { cancelRequested: true },
    });

    return NextResponse.json({
      success: true,
      message: "Cancellation requested. The sync will stop shortly.",
    });
  } catch (error: any) {
    console.error("Error cancelling sync job:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel sync job" },
      { status: 500 }
    );
  }
}
