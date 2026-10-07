import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

const DEFAULT_AGREEMENT_FORMS = [
  {
    key: "payment_term",
    title: "Payment Term",
    content: "",
    isActive: true,
    sortOrder: 10,
  },
  {
    key: "cabinet_agreement",
    title: "Cabinet Agreement",
    content: "",
    isActive: true,
    sortOrder: 20,
  },
  {
    key: "countertop_agreement",
    title: "Countertop Agreement",
    content: "",
    isActive: true,
    sortOrder: 30,
  },
  {
    key: "repair_agreement",
    title: "Repair Agreement",
    content: "",
    isActive: true,
    sortOrder: 40,
  },
  {
    key: "honed_agreement",
    title: "Honed Agreement",
    content: "",
    isActive: true,
    sortOrder: 50,
  },
];

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { error: null };
}

async function ensureAgreementReader() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // Read access follows Payment Terms access (Settings → Program Access).
  const { isActive, canAccess, isGlobalAdmin } =
    await getProgramUserContext("paymentTerms");
  if (!isActive || !(canAccess || isGlobalAdmin)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { error: null };
}

async function ensureDefaultTemplates() {
  for (const template of DEFAULT_AGREEMENT_FORMS) {
    await prismaAny.agreementFormTemplate.upsert({
      where: { key: template.key },
      create: template,
      update: {},
    });
  }
}

export async function GET() {
  try {
    const auth = await ensureAgreementReader();
    if (auth.error) return auth.error;

    await ensureDefaultTemplates();

    // Return only user-editable templates (exclude system templates like Payment Term)
    const templates = await prismaAny.agreementFormTemplate.findMany({
      where: { key: { not: "payment_term" } },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch agreement forms" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const incoming = Array.isArray(body?.templates) ? body.templates : null;

    if (!incoming) {
      return NextResponse.json(
        { error: "Invalid payload. Expected templates array." },
        { status: 400 },
      );
    }

    for (const row of incoming) {
      const key = String(row?.key || "").trim();
      const title = String(row?.title || "").trim();
      const content = String(row?.content || "");
      const isActive = Boolean(row?.isActive);
      const sortOrder = Number.isFinite(Number(row?.sortOrder))
        ? Number(row.sortOrder)
        : 0;

      if (!key || !title) {
        return NextResponse.json(
          { error: "Each template requires key and title." },
          { status: 400 },
        );
      }

      await prismaAny.agreementFormTemplate.upsert({
        where: { key },
        create: {
          key,
          title,
          content,
          isActive,
          sortOrder,
        },
        update: {
          title,
          content,
          isActive,
          sortOrder,
        },
      });
    }

    const templates = await prismaAny.agreementFormTemplate.findMany({
      where: { key: { not: "payment_term" } },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update agreement forms" },
      { status: 500 },
    );
  }
}
