import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { getFabricationSettingsCategoryConfig } from "@/lib/fabricationSettings";

const prismaAny = prisma as any;

type SettingsBody = {
  id?: string;
  name?: string;
  value?: number;
  isBuildUp?: boolean;
  sortOrder?: number;
  active?: boolean;
  action?: "save" | "activate" | "deactivate" | "delete";
};

async function requireAdmin() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (appRole !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ category: string }> },
) {
  const { category } = await context.params;
  const config = getFabricationSettingsCategoryConfig(category);
  if (!config) {
    return NextResponse.json({ error: "Unknown settings category" }, { status: 404 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const model = prismaAny[config.modelKey];
  const items = await model.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(
    items.map((item: any) =>
      config.dbField
        ? { ...item, [config.dbField]: Number(item[config.dbField]) }
        : item,
    ),
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ category: string }> },
) {
  const { category } = await context.params;
  const config = getFabricationSettingsCategoryConfig(category);
  if (!config) {
    return NextResponse.json({ error: "Unknown settings category" }, { status: 404 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const model = prismaAny[config.modelKey];

  try {
    const body = (await request.json()) as SettingsBody;
    const id = body.id?.trim();
    const action = body.action || "save";

    // Archive / restore (soft delete)
    if (action === "activate" || action === "deactivate") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      const updated = await model.update({
        where: { id },
        data: { active: action === "activate" },
      });
      return NextResponse.json(
        config.dbField
          ? { ...updated, [config.dbField]: Number(updated[config.dbField]) }
          : updated,
      );
    }

    // Permanent delete - only when not referenced by any existing order area
    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      const existing = await model.findUnique({ where: { id } });
      try {
        await model.delete({ where: { id } });
      } catch (err: any) {
        if (err?.code === "P2003" || err?.code === "P2014") {
          return NextResponse.json(
            {
              error:
                "This item is used by one or more saved fabrication orders and can't be permanently deleted. Archive it instead.",
            },
            { status: 409 },
          );
        }
        throw err;
      }

      await prismaAny.fabricationPriceChangeLog.create({
        data: {
          entityType: config.entityType,
          entityId: id,
          entityName: existing?.name || "Unknown",
          fieldName: "deleted",
          oldValue: "exists",
          newValue: "permanently deleted",
          changedById: auth.user.id,
        },
      });

      return NextResponse.json({ success: true });
    }

    // Create / update
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const value = Number.isFinite(body.value) ? Number(body.value) : 0;
    const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0;
    const active = body.active !== false;

    const data: Record<string, unknown> = {
      name,
      sortOrder,
      active,
    };
    if (config.dbField) {
      data[config.dbField] = value;
    }
    if (config.hasBuildUpFlag) {
      data.isBuildUp = Boolean(body.isBuildUp);
    }

    if (id) {
      const existing = await model.findUnique({ where: { id } });
      const updated = await model.update({ where: { id }, data });

      if (
        config.dbField &&
        existing &&
        Number(existing[config.dbField]) !== value
      ) {
        await prismaAny.fabricationPriceChangeLog.create({
          data: {
            entityType: config.entityType,
            entityId: updated.id,
            entityName: updated.name,
            fieldName: config.dbField,
            oldValue: String(existing[config.dbField]),
            newValue: String(value),
            changedById: auth.user.id,
          },
        });
      }

      return NextResponse.json(
        config.dbField
          ? { ...updated, [config.dbField]: Number(updated[config.dbField]) }
          : updated,
      );
    }

    const created = await model.create({ data });

    if (config.dbField) {
      await prismaAny.fabricationPriceChangeLog.create({
        data: {
          entityType: config.entityType,
          entityId: created.id,
          entityName: created.name,
          fieldName: config.dbField,
          oldValue: null,
          newValue: String(value),
          changedById: auth.user.id,
        },
      });
    }

    return NextResponse.json(
      config.dbField
        ? { ...created, [config.dbField]: Number(created[config.dbField]) }
        : created,
    );
  } catch (error: any) {
    const message =
      error?.code === "P2002"
        ? "That name already exists in this list."
        : error?.message || "Failed to save item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
