import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseAmount(value: unknown): number {
  const raw = typeof value === "string" ? value : String(value ?? "");
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function requireUserEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return null;
  }
  return email;
}

async function generateMonthlyPaymentTermNumber() {
  const now = new Date();
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
  const startOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
    0,
    0,
    0,
    0,
  );

  const currentMonthCount = await prisma.jobArtifact.count({
    where: {
      sourceApp: "PAYMENT_TERM",
      createdAt: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
    },
  });

  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(currentMonthCount + 1).padStart(3, "0");
  return `PT${yy}${mm}${seq}`;
}

export async function GET(request: NextRequest) {
  try {
    const email = await requireUserEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id")?.trim();

    if (id) {
      const artifact = await prisma.jobArtifact.findFirst({
        where: {
          id,
          sourceApp: "PAYMENT_TERM",
        },
        select: {
          id: true,
          title: true,
          metadata: true,
          createdAt: true,
        },
      });

      if (!artifact) {
        return NextResponse.json(
          { error: "Payment term not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        id: artifact.id,
        title: artifact.title,
        metadata: artifact.metadata ?? {},
        createdAt: artifact.createdAt,
      });
    }

    const artifacts = await prisma.jobArtifact.findMany({
      where: { sourceApp: "PAYMENT_TERM" },
      select: {
        id: true,
        title: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ artifacts });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load payment terms" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const email = await requireUserEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const customerId = String(body?.customerId ?? "").trim();
    const jobId = String(body?.jobId ?? "").trim();

    if (!customerId || !jobId) {
      return NextResponse.json(
        { error: "Customer and deal/job are required" },
        { status: 400 },
      );
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, customerId },
      select: { id: true },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Selected deal does not belong to selected client" },
        { status: 400 },
      );
    }

    const paymentTermNumber = await generateMonthlyPaymentTermNumber();
    const now = new Date();
    const showInCustomerFiles = body?.showInCustomerFiles !== false;

    if (showInCustomerFiles) {
      const existing = await prisma.jobArtifact.findMany({
        where: {
          jobId,
          sourceApp: "PAYMENT_TERM",
        },
        select: {
          id: true,
          metadata: true,
        },
      });

      if (existing.length > 0) {
        await prisma.$transaction(
          existing.map((artifact) => {
            const meta =
              artifact.metadata && typeof artifact.metadata === "object"
                ? (artifact.metadata as Record<string, unknown>)
                : {};
            return prisma.jobArtifact.update({
              where: { id: artifact.id },
              data: {
                metadata: {
                  ...meta,
                  showInCustomerFiles: false,
                },
              },
            });
          }),
        );
      }
    }

    const metadata = {
      paymentTermNumber,
      customerId,
      customerName: String(body?.customerName ?? "").trim(),
      customerPipedriveId: body?.customerPipedriveId ?? null,
      customerAddress: body?.customerAddress ?? null,
      contractor: body?.contractor ?? null,
      jobId,
      dealId: body?.dealId ?? null,
      dealName: body?.dealName ?? null,
      jobStatus: body?.jobStatus ?? null,
      address: body?.address ?? null,
      salesRep: String(body?.salesRep ?? "").trim(),
      date: String(body?.date ?? "").trim(),
      revNum: String(body?.revNum ?? "1").trim(),
      invoices: Array.isArray(body?.invoices) ? body.invoices : [],
      lineItemsByInvoice:
        body?.lineItemsByInvoice && typeof body.lineItemsByInvoice === "object"
          ? body.lineItemsByInvoice
          : {},
      countertopAgreementSpecs: Array.isArray(body?.countertopAgreementSpecs)
        ? body.countertopAgreementSpecs
        : [],
      totals: {
        invoiceTotal: parseAmount(body?.totals?.invoiceTotal),
        minimumDeposit: parseAmount(body?.totals?.minimumDeposit),
        clientDeposit: parseAmount(body?.totals?.clientDeposit),
        remainingBalance: parseAmount(body?.totals?.remainingBalance),
        byType:
          body?.totals?.byType && typeof body.totals.byType === "object"
            ? body.totals.byType
            : {
                cabinet: { total: 0, deposit: 0, balance: 0 },
                countertop: { total: 0, deposit: 0, balance: 0 },
              },
      },
      adjustedInvoiceBreakdown: Array.isArray(body?.adjustedInvoiceBreakdown)
        ? body.adjustedInvoiceBreakdown
        : [],
      sourceArtifactId: body?.sourceArtifactId ?? null,
      showInCustomerFiles,
      savedAt: now.toISOString(),
      savedBy: email,
    };

    const artifact = await prisma.jobArtifact.create({
      data: {
        jobId,
        sourceApp: "PAYMENT_TERM",
        type: "SNAPSHOT",
        title: `Payment Term ${paymentTermNumber}`,
        metadata,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      id: artifact.id,
      paymentTermNumber,
      savedAt: artifact.createdAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save payment term" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const email = await requireUserEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const id = String(body?.id ?? "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "Artifact id is required" },
        { status: 400 },
      );
    }

    const artifact = await prisma.jobArtifact.findFirst({
      where: {
        id,
        sourceApp: "PAYMENT_TERM",
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    if (!artifact) {
      return NextResponse.json(
        { error: "Payment term not found" },
        { status: 404 },
      );
    }

    const existingMeta =
      artifact.metadata && typeof artifact.metadata === "object"
        ? (artifact.metadata as Record<string, unknown>)
        : {};

    const countertopAgreementSpecs = Array.isArray(
      body?.countertopAgreementSpecs,
    )
      ? body.countertopAgreementSpecs
      : [];

    await prisma.jobArtifact.update({
      where: { id: artifact.id },
      data: {
        metadata: {
          ...existingMeta,
          countertopAgreementSpecs,
          savedAt: new Date().toISOString(),
          savedBy: email,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update payment term" },
      { status: 500 },
    );
  }
}
