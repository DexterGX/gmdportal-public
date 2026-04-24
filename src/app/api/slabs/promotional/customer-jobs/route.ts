import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CustomerOption = {
  id: string;
  pipedriveId: string | null;
  displayName: string;
  companyName: string | null;
};

type JobOption = {
  id: string;
  jobName: string;
  pipedriveId: string | null;
  dealTitle: string | null;
  status: string;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const customerId = searchParams.get("customerId")?.trim() ?? "";

  let customers: CustomerOption[] = [];
  if (q.length >= 2) {
    const customerRows = await prisma.customer.findMany({
      where: {
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        pipedriveId: true,
        displayName: true,
        companyName: true,
      },
      orderBy: { displayName: "asc" },
      take: 12,
    });
    customers = customerRows;
  }

  let jobs: JobOption[] = [];
  if (customerId) {
    const jobRows = await prisma.job.findMany({
      where: {
        customerId,
        ...(q.length >= 2
          ? {
              OR: [
                { jobName: { contains: q, mode: "insensitive" } },
                { dealTitle: { contains: q, mode: "insensitive" } },
                { pipedriveId: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        jobName: true,
        pipedriveId: true,
        dealTitle: true,
        status: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    });
    jobs = jobRows;
  }

  return NextResponse.json({ customers, jobs });
}
