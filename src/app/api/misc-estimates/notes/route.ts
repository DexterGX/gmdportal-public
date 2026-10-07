import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notes = await prismaAny.miscProgramNote.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        content: true,
        catalogUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      notes: notes.map((n: any) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch notes" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getProgramUserContext("miscEstimates");
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const title = String(body?.title ?? "").trim();
    const content = String(body?.content ?? "").trim();
    const catalogUrlRaw = String(body?.catalogUrl ?? "").trim();

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 },
      );
    }

    if (catalogUrlRaw && !/^https?:\/\//i.test(catalogUrlRaw)) {
      return NextResponse.json(
        { error: "Catalogue link must start with http:// or https://" },
        { status: 400 },
      );
    }

    const note = await prismaAny.miscProgramNote.create({
      data: {
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

    const { appRole } = await getProgramUserContext("miscEstimates");
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

    const note = await prismaAny.miscProgramNote.findUnique({
      where: { id: noteId },
    });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await prismaAny.miscProgramNote.delete({ where: { id: noteId } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete note" },
      { status: 500 },
    );
  }
}
