import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import QuoteReviewClient from "./QuoteReviewClient";

type QuoteReviewPageProps = {
  params: Promise<{ jobId: string; quoteId: string }>;
};

export default async function QuoteReviewPage(props: QuoteReviewPageProps) {
  const { jobId, quoteId } = await props.params;
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("closetJobs");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  // Only ADMIN and SALES can review quotes
  if (!["admin", "sales"].includes(appRole)) {
    redirect("/closet-jobs");
  }

  const quote = await prisma.closetQuote.findUnique({
    where: { id: quoteId },
    include: {
      closetJob: true,
      files: true,
    },
  });

  if (!quote || quote.closetJobId !== jobId) {
    redirect(`/closet-jobs/${jobId}`);
  }

  // Fetch user details
  const [salesPerson, installer, approvedBy] = await Promise.all([
    prisma.user.findUnique({
      where: { id: quote.closetJob.salesPersonId },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: quote.closetJob.installerId },
      select: { id: true, name: true, email: true },
    }),
    quote.approvedById
      ? prisma.user.findUnique({
          where: { id: quote.approvedById },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  // Serialize data
  const quoteData = {
    id: quote.id,
    quoteCode: quote.quoteCode,
    color: quote.color,
    installerCost: quote.installerCost.toString(),
    gmFactor: quote.gmFactor?.toString() || null,
    finalPrice: quote.finalPrice.toString(),
    notesInstaller: quote.notesInstaller,
    notesSales: quote.notesSales,
    status: quote.status,
    createdAt: quote.createdAt.toISOString(),
    submittedAt: quote.submittedAt?.toISOString() || null,
    approvedAt: quote.approvedAt?.toISOString() || null,
    approvedBy: approvedBy || null,
    lastPrintedAt: quote.lastPrintedAt?.toISOString() || null,
    files: quote.files.map((f: Prisma.ClosetQuoteFileGetPayload<{}>) => ({
      id: f.id,
      fileUrl: f.fileUrl,
      type: f.type,
      caption: f.caption,
      uploadedAt: f.uploadedAt.toISOString(),
    })),
    closetJob: {
      id: quote.closetJob.id,
      quoteNumber: quote.closetJob.quoteNumber,
      customerName: quote.closetJob.customerName,
      customerPhone: quote.closetJob.customerPhone,
      propertyAddress: quote.closetJob.propertyAddress,
      area: quote.closetJob.area,
      status: quote.closetJob.status,
      createdAt: quote.closetJob.createdAt.toISOString(),
      salesPerson: salesPerson || null,
      installer: installer || null,
    },
  };

  return <QuoteReviewClient quote={quoteData} userRole={appRole} />;
}
