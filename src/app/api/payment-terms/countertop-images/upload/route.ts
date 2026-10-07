import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { promises as fs } from "fs";
import path from "path";
import {
  normalizeOptionKey,
  type CountertopImageCategory,
} from "@/lib/countertopAgreementOptions";

function isValidCategory(value: unknown): value is CountertopImageCategory {
  return value === "sink" || value === "thickness" || value === "edge";
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole, isActive } = await getProgramUserContext("paymentTerms");
    if (!isActive || appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const categoryInput = formData.get("category");
    const optionKeyInput = formData.get("optionKey");

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const category = String(categoryInput || "").trim();
    if (!isValidCategory(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const optionKey = normalizeOptionKey(String(optionKeyInput || ""));
    if (!optionKey) {
      return NextResponse.json(
        { error: "optionKey is required" },
        { status: 400 },
      );
    }

    const fileName =
      file instanceof File && file.name ? file.name : "image.png";
    const ext = fileName.split(".").pop()?.toLowerCase() || "png";
    const safeExt = ext.replace(/[^a-z0-9]/g, "") || "png";

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueFileName = `${category}-${optionKey}-${Date.now()}.${safeExt}`;
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "payment-terms",
      "countertop-images",
      category,
    );
    const filePath = path.join(uploadDir, uniqueFileName);

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(filePath, buffer);

    const imageUrl = `/payment-terms/countertop-images/${category}/${uniqueFileName}`;

    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upload image" },
      { status: 500 },
    );
  }
}
