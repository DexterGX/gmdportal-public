import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AgreementKey =
  | "cabinet_agreement"
  | "countertop_agreement"
  | "repair_agreement"
  | "honed_agreement";

const AGREEMENT_LABELS: Record<AgreementKey, string> = {
  cabinet_agreement: "Cabinet Agreement",
  countertop_agreement: "Countertop Agreement",
  repair_agreement: "Repair Agreement",
  honed_agreement: "Honed Agreement",
};

async function requireUserEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const email = await requireUserEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const paymentTermArtifactId = String(
      body?.paymentTermArtifactId ?? "",
    ).trim();
    const agreementKey = String(
      body?.agreementKey ?? "",
    ).trim() as AgreementKey;

    if (!paymentTermArtifactId) {
      return NextResponse.json(
        { error: "Payment term artifact id is required" },
        { status: 400 },
      );
    }

    if (!(agreementKey in AGREEMENT_LABELS)) {
      return NextResponse.json(
        { error: "Invalid agreement key" },
        { status: 400 },
      );
    }

    const paymentTermArtifact = await prisma.jobArtifact.findFirst({
      where: {
        id: paymentTermArtifactId,
        sourceApp: "PAYMENT_TERM",
      },
      select: {
        id: true,
        jobId: true,
        metadata: true,
      },
    });

    if (!paymentTermArtifact) {
      return NextResponse.json(
        { error: "Payment term not found" },
        { status: 404 },
      );
    }

    const paymentMeta =
      paymentTermArtifact.metadata &&
      typeof paymentTermArtifact.metadata === "object"
        ? (paymentTermArtifact.metadata as Record<string, unknown>)
        : {};

    const paymentTermNumber = String(
      paymentMeta.paymentTermNumber ?? "",
    ).trim();
    const revNum = String(paymentMeta.revNum ?? "").trim();
    const agreementLabel = AGREEMENT_LABELS[agreementKey];
    const titleSuffix = paymentTermNumber
      ? ` - ${paymentTermNumber}${revNum ? ` Rev ${revNum}` : ""}`
      : "";

    const artifact = await prisma.jobArtifact.create({
      data: {
        jobId: paymentTermArtifact.jobId,
        sourceApp: "PAYMENT_TERM_PRINT",
        type: "SNAPSHOT",
        title: `${agreementLabel}${titleSuffix}`,
        metadata: {
          paymentTermArtifactId: paymentTermArtifact.id,
          agreementKey,
          showInCustomerFiles: true,
          printedBy: email,
          printedAt: new Date().toISOString(),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ id: artifact.id });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to record printed document" },
      { status: 500 },
    );
  }
}
