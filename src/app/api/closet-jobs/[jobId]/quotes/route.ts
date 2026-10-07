import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

type QuotesRouteContext = {
  params: Promise<{ jobId: string }>;
};

function getNextQuoteCode(
  jobQuoteNumber: string,
  existingQuoteCodes: string[],
) {
  const prefix = `${jobQuoteNumber}-Q`;
  let maxSuffix = 0;

  for (const rawQuoteCode of existingQuoteCodes) {
    const quoteCode = String(rawQuoteCode ?? "").trim();
    if (!quoteCode.startsWith(prefix)) {
      continue;
    }

    const suffix = Number.parseInt(quoteCode.slice(prefix.length), 10);
    if (Number.isFinite(suffix)) {
      maxSuffix = Math.max(maxSuffix, suffix);
    }
  }

  return `${prefix}${maxSuffix + 1}`;
}

function isQuoteCodeUniqueConstraintError(error: unknown) {
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    (error as { code?: string }).code !== "P2002"
  ) {
    return false;
  }

  const target = (error as { meta?: { target?: string | string[] } }).meta
    ?.target;

  if (Array.isArray(target)) {
    return target.includes("quoteCode");
  }

  return typeof target === "string" && target.includes("quoteCode");
}

// GET /api/closet-jobs/[jobId]/quotes - List quotes for a job
export async function GET(request: NextRequest, context: QuotesRouteContext) {
  try {
    const { jobId } = await context.params;
    const { user, appRole, appRoles, canAccess } = await getProgramUserContext("closetJobs");

    if (!user || appRoles.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canAccess) {
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
      { status: 500 },
    );
  }
}

// POST /api/closet-jobs/[jobId]/quotes - Create/submit a quote (Installer or Admin)
export async function POST(request: NextRequest, context: QuotesRouteContext) {
  try {
    const { jobId } = await context.params;
    const { user, appRole, appRoles } = await getProgramUserContext("closetJobs");

    if (!user || appRoles.length === 0) {
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
      installerId: providedInstallerId,
    } = body;

    if (!color || !installerCost) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Determine effective installer ID
    let effectiveInstallerId: string;

    if (appRole === "installer") {
      // Installer must be assigned to this job
      if (job.installerId !== user.id) {
        return NextResponse.json(
          { error: "Only the assigned installer can submit quotes" },
          { status: 403 },
        );
      }
      effectiveInstallerId = user.id;
    } else if (appRole === "admin") {
      // Admin can specify installer or default to job's assigned installer
      effectiveInstallerId = providedInstallerId || job.installerId;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const quoteCodePrefix = `${job.quoteNumber}-Q`;
    let quote = null;
    let latestQuoteCodes = (
      await prisma.closetQuote.findMany({
        where: {
          quoteCode: {
            startsWith: quoteCodePrefix,
          },
        },
        select: { quoteCode: true },
      })
    ).map((existingQuote) => existingQuote.quoteCode);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const quoteCode = getNextQuoteCode(job.quoteNumber, latestQuoteCodes);

      try {
        // Create the quote (files are uploaded separately via the files endpoint)
        quote = await prisma.closetQuote.create({
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
        break;
      } catch (error) {
        if (!isQuoteCodeUniqueConstraintError(error) || attempt === 2) {
          throw error;
        }

        const existingQuotes = await prisma.closetQuote.findMany({
          where: {
            quoteCode: {
              startsWith: quoteCodePrefix,
            },
          },
          select: { quoteCode: true },
        });
        latestQuoteCodes = existingQuotes.map(
          (existingQuote) => existingQuote.quoteCode,
        );
      }
    }

    if (!quote) {
      throw new Error("Failed to allocate a unique quote code");
    }

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
      { status: 500 },
    );
  }
}
