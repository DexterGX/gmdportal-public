import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

type QuotesRouteContext = {
  params: Promise<{ jobId: string }>;
};

// GET /api/closet-jobs/[jobId]/quotes - List quotes for a job
export async function GET(request: NextRequest, context: QuotesRouteContext) {
  try {
    const { jobId } = await context.params;
    const { user, appRole } = await getCurrentUserWithRole();

    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "sales", "installer"].includes(appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const quotes = await prisma.closetQuote.findMany({
      where: { closetJobId: jobId },
      include: {
        files: true,
        installer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(quotes);
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}

// POST /api/closet-jobs/[jobId]/quotes - Create/submit a quote (Installer or Admin)
export async function POST(request: NextRequest, context: QuotesRouteContext) {
  try {
    const { jobId } = await context.params;
    const { user, appRole } = await getCurrentUserWithRole();

    if (!user || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only INSTALLER or ADMIN can create quotes
    if (!["installer", "admin"].includes(appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify the job exists
    const job = await prisma.closetJob.findUnique({
      where: { id: jobId },
      include: { quotes: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      color,
      installerCost,
      notesInstaller,
      files,
      installerId: providedInstallerId,
    } = body;

    if (!color || !installerCost) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Determine effective installer ID
    let effectiveInstallerId: string;

    if (appRole === "installer") {
      // Installer must be assigned to this job
      if (job.installerId !== user.id) {
        return NextResponse.json(
          { error: "Only the assigned installer can submit quotes" },
          { status: 403 }
        );
      }
      effectiveInstallerId = user.id;
    } else if (appRole === "admin") {
      // Admin can specify installer or default to job's assigned installer
      effectiveInstallerId = providedInstallerId || job.installerId;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate quote code: {job.quoteNumber}-Q{N}
    const quoteCount = job.quotes.length;
    const quoteCode = `${job.quoteNumber}-Q${quoteCount + 1}`;

    // Get default GM factor from settings
    let settings = await prisma.closetEstimateSettings.findFirst();
    if (!settings) {
      // Create default settings if they don't exist
      settings = await prisma.closetEstimateSettings.create({
        data: {
          defaultGmFactor: 1.35,
          quoteNumberFormat: "{INITIALS}-CQUO-{YYMMDD}-{SEQ3}",
        },
      });
    }
    const gmFactor = settings.defaultGmFactor;
    const finalPrice =
      parseFloat(installerCost) * parseFloat(gmFactor.toString());

    // Create the quote
    const quote = await prisma.closetQuote.create({
      data: {
        closetJobId: jobId,
        quoteCode,
        color,
        installerCost,
        gmFactor,
        finalPrice,
        notesInstaller,
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
        installerId: effectiveInstallerId,
        submittedById: user.id,
        files: files
          ? {
              create: files.map((file: any) => ({
                fileUrl: file.fileUrl,
                type: file.type || "3D_RENDER",
                caption: file.caption,
                uploadedById: user.id,
              })),
            }
          : undefined,
      },
      include: {
        files: true,
        installer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update job status to REVIEW if it was QUOTE
    if (job.status === "QUOTE") {
      await prisma.closetJob.update({
        where: { id: jobId },
        data: { status: "REVIEW" },
      });
    }

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error("Error creating quote:", error);
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}
