import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import PrintQuoteLayout from "./PrintQuoteLayout";

type PrintQuotePageProps = {
  params: Promise<{ jobId: string; quoteId: string }>;
  searchParams: Promise<{ auto?: string }>;
};

export default async function PrintQuotePage(props: PrintQuotePageProps) {
  const { jobId, quoteId } = await props.params;
  const searchParams = await props.searchParams;
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  // Only ADMIN and SALES can print quotes
  if (!user || !isActive || !["admin", "sales"].includes(appRole)) {
    redirect("/login");
  }

  const quote = await prisma.closetQuote.findUnique({
    where: { id: quoteId },
    include: {
      closetJob: true,
      files: {
        where: {
          type: "3D_RENDER",
        },
        orderBy: {
          uploadedAt: "asc",
        },
      },
    },
  });

  if (!quote || quote.closetJobId !== jobId) {
    redirect(`/closet-jobs/${jobId}`);
  }

  // Update last printed timestamp
  await prisma.closetQuote.update({
    where: { id: quoteId },
    data: {
      lastPrintedAt: new Date(),
      lastPrintedById: user.id,
    },
  });

  // Fetch user details for sales person
  const salesPerson = await prisma.user.findUnique({
    where: { id: quote.closetJob.salesPersonId },
    select: { name: true, email: true },
  });

  // Get area label
  const getAreaLabel = (area: string) => {
    const labels: Record<string, string> = {
      MASTER: "Master Closet",
      GUEST: "Guest Closet",
      GARAGE: "Garage",
      KITCHEN: "Kitchen",
      WALL_UNIT: "Wall Unit",
      LAUNDRY: "Laundry",
      OTHER: "Other",
    };
    return labels[area] || area;
  };

  // Create DTOs without installerCost
  const jobDTO = {
    quoteNumber: quote.closetJob.quoteNumber,
    propertyAddress: quote.closetJob.propertyAddress,
    areaLabel: getAreaLabel(quote.closetJob.area),
    customerName: quote.closetJob.customerName,
    salesPersonName: salesPerson?.name || "GM Design",
    salesPersonEmail: salesPerson?.email || "",
    createdAt: quote.closetJob.createdAt.toISOString(),
    approvedAt: quote.approvedAt?.toISOString() || null,
  };

  const quoteDTO = {
    quoteCode: quote.quoteCode,
    color: quote.color,
    finalPriceNumber: parseFloat(quote.finalPrice.toString()),
    finalPriceFormatted: `$${parseFloat(
      quote.finalPrice.toString()
    ).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
  };

  const filesDTO = quote.files.map(
    (f: Prisma.ClosetQuoteFileGetPayload<{}>) => ({
      fileUrl: f.fileUrl,
      caption: f.caption,
    })
  );

  const autoPrint = searchParams.auto === "1";

  return (
    <PrintQuoteLayout
      autoPrint={autoPrint}
      job={jobDTO}
      quote={quoteDTO}
      files={filesDTO}
    />
  );
}
