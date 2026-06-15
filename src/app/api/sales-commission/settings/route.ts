import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSalesCommissionAccess } from "@/lib/salesCommissionAuth";
import { Prisma } from "@prisma/client";

const DEFAULT_NOTE_OPTIONS = [
  "Hold - Missing client signature",
  "Hold - No deposit received",
  "Hold - Waiting final payment",
  "Hold - Refund applied",
  "Hold - 3rd party involved",
  "Credit memo",
  "Manual review needed",
  "Commission rate mistake in QuickBooks",
  "Other",
];

async function ensureSettings() {
  const existing = await prisma.salesCommissionSettings.findFirst();
  if (existing) {
    return existing;
  }

  return prisma.salesCommissionSettings.create({
    data: {
      firstCommissionPercent: new Prisma.Decimal(60),
      secondCommissionPercent: new Prisma.Decimal(40),
      minimumWeeklyPay: new Prisma.Decimal(560),
      monthlyBonusSalesTarget: new Prisma.Decimal(200000),
      monthlyBonusAmount: new Prisma.Decimal(2500),
      payWeekStartDay: 5,
      payWeekEndDay: 4,
      checkDateRule: "SECOND_MONDAY_AFTER_PERIOD_END",
    },
  });
}

async function ensureDefaultNoteOptions() {
  const count = await prisma.salesCommissionNoteOption.count();
  if (count > 0) {
    return;
  }

  await prisma.salesCommissionNoteOption.createMany({
    data: DEFAULT_NOTE_OPTIONS.map((label, index) => ({
      label,
      isSystem: true,
      sortOrder: index,
    })),
  });
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET() {
  try {
    const access = await requireSalesCommissionAccess();
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    await ensureDefaultNoteOptions();
    const [settings, salesReps, noteOptions] = await Promise.all([
      ensureSettings(),
      prisma.salesCommissionSalesRep.findMany({
        orderBy: [{ active: "desc" }, { displayName: "asc" }],
      }),
      prisma.salesCommissionNoteOption.findMany({
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
    ]);

    return NextResponse.json({
      settings,
      salesReps,
      noteOptions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load sales commission settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await requireSalesCommissionAccess();
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    if (!["admin", "finance"].includes(access.appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const settings = body?.settings ?? {};
    const salesReps = Array.isArray(body?.salesReps) ? body.salesReps : [];
    const noteOptions = Array.isArray(body?.noteOptions)
      ? body.noteOptions
      : [];

    const current = await ensureSettings();

    await prisma.$transaction(async (tx) => {
      await tx.salesCommissionSettings.update({
        where: { id: current.id },
        data: {
          firstCommissionPercent: new Prisma.Decimal(
            toNumber(settings.firstCommissionPercent, 60),
          ),
          secondCommissionPercent: new Prisma.Decimal(
            toNumber(settings.secondCommissionPercent, 40),
          ),
          minimumWeeklyPay: new Prisma.Decimal(
            toNumber(settings.minimumWeeklyPay, 560),
          ),
          monthlyBonusSalesTarget: new Prisma.Decimal(
            toNumber(settings.monthlyBonusSalesTarget, 200000),
          ),
          monthlyBonusAmount: new Prisma.Decimal(
            toNumber(settings.monthlyBonusAmount, 2500),
          ),
          payWeekStartDay: Math.max(
            0,
            Math.min(6, toNumber(settings.payWeekStartDay, 5)),
          ),
          payWeekEndDay: Math.max(
            0,
            Math.min(6, toNumber(settings.payWeekEndDay, 4)),
          ),
          checkDateRule: String(
            settings.checkDateRule || "SECOND_MONDAY_AFTER_PERIOD_END",
          ),
        },
      });

      if (salesReps.length > 0) {
        for (const rep of salesReps) {
          const id = typeof rep.id === "string" ? rep.id : "";
          const displayName = String(rep.displayName || "").trim();
          const quickbooksInitials = String(
            rep.quickbooksInitials || "",
          ).trim();

          if (!displayName || !quickbooksInitials) {
            continue;
          }

          if (id) {
            await tx.salesCommissionSalesRep.update({
              where: { id },
              data: {
                displayName,
                quickbooksInitials,
                active: rep.active !== false,
                defaultCommissionRate:
                  rep.defaultCommissionRate === null ||
                  rep.defaultCommissionRate === undefined
                    ? null
                    : new Prisma.Decimal(
                        toNumber(rep.defaultCommissionRate, 0),
                      ),
                notes:
                  typeof rep.notes === "string" && rep.notes.trim()
                    ? rep.notes.trim()
                    : null,
              },
            });
          } else {
            await tx.salesCommissionSalesRep.create({
              data: {
                displayName,
                quickbooksInitials,
                active: rep.active !== false,
                defaultCommissionRate:
                  rep.defaultCommissionRate === null ||
                  rep.defaultCommissionRate === undefined
                    ? null
                    : new Prisma.Decimal(
                        toNumber(rep.defaultCommissionRate, 0),
                      ),
                notes:
                  typeof rep.notes === "string" && rep.notes.trim()
                    ? rep.notes.trim()
                    : null,
              },
            });
          }
        }
      }

      if (noteOptions.length > 0) {
        for (const option of noteOptions) {
          const id = typeof option.id === "string" ? option.id : "";
          const label = String(option.label || "").trim();
          if (!label) {
            continue;
          }

          if (id) {
            await tx.salesCommissionNoteOption.update({
              where: { id },
              data: {
                label,
                isActive: option.isActive !== false,
                sortOrder: toNumber(option.sortOrder, 0),
              },
            });
          } else {
            await tx.salesCommissionNoteOption.create({
              data: {
                label,
                isSystem: false,
                isActive: option.isActive !== false,
                sortOrder: toNumber(option.sortOrder, 0),
              },
            });
          }
        }
      }

      await tx.salesCommissionAuditLog.create({
        data: {
          entityType: "SETTINGS",
          entityId: current.id,
          fieldName: "bulkUpdate",
          oldValue: Prisma.JsonNull,
          newValue: {
            updatedBy: access.userId,
            salesRepUpdates: salesReps.length,
            noteOptionUpdates: noteOptions.length,
          },
          changedByUserId: access.userId,
        },
      });
    });

    return GET();
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save settings" },
      { status: 500 },
    );
  }
}
