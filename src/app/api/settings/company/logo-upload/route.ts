import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";

const prismaAny = prisma as any;

async function ensureCompanySettingsId() {
  const existing = await prismaAny.companyDocumentSettings.findFirst({
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prismaAny.companyDocumentSettings.create({
    data: {
      companyName: "GM Design",
      phoneNumber: "(305) XXX-XXXX",
      logoUrl: "/logo.svg",
    },
    select: { id: true },
  });

  return created.id;
}

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

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Invalid file format" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const settingsId = await ensureCompanySettingsId();

    const fileName =
      file instanceof File && file.name ? file.name : "company-logo.png";
    const ext = fileName.split(".").pop() ?? "png";
    const uniqueFileName = `${settingsId}-${Date.now()}.${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "company-logos");
    const filePath = path.join(uploadDir, uniqueFileName);

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(filePath, buffer);

    const logoUrl = `/company-logos/${uniqueFileName}`;

    await prismaAny.companyDocumentSettings.update({
      where: { id: settingsId },
      data: { logoUrl },
    });

    return NextResponse.json({ logoUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upload company logo" },
      { status: 500 },
    );
  }
}
