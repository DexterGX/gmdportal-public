import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const brandId = String(body?.brandId ?? "").trim();
    const title = String(body?.title ?? "").trim();
    const content = String(body?.content ?? "").trim();
    const catalogUrlRaw = String(body?.catalogUrl ?? "").trim();

    if (!brandId || !title || !content) {
      return NextResponse.json(
        { error: "Brand, title, and content are required" },
        { status: 400 },
      );
    }

    if (catalogUrlRaw && !/^https?:\/\//i.test(catalogUrlRaw)) {
      return NextResponse.json(
        { error: "Catalogue link must start with http:// or https://" },
        { status: 400 },
      );
    }

    const prismaAny = prisma as any;
    const brand = await prismaAny.sinkBrand.findUnique({
      where: { id: brandId },
    });
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const note = await prismaAny.sinkBrandNote.create({
      data: {
        brandId,
        title,
        content,
        catalogUrl: catalogUrlRaw || null,
      },
      select: {
        id: true,
        title: true,
        content: true,
        catalogUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      note: {
        ...note,
        createdAt: note.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create note" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const noteId = String(body?.noteId ?? "").trim();

    if (!noteId) {
      return NextResponse.json(
        { error: "Note id is required" },
        { status: 400 },
      );
    }

    const prismaAny = prisma as any;
    const note = await prismaAny.sinkBrandNote.findUnique({
      where: { id: noteId },
    });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await prismaAny.sinkBrandNote.delete({ where: { id: noteId } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete note" },
      { status: 500 },
    );
  }
}
