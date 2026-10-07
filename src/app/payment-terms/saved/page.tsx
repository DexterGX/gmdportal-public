import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import SavedPaymentTermsClient from "./SavedPaymentTermsClient";

type SavedPaymentTermRow = {
  id: string;
  paymentTermNumber: string;
  revNum: string;
  title: string;
  customerName: string;
  dealName: string;
  address: string | null;
  salesRep: string | null;
  showInCustomerFiles: boolean;
  createdAt: string;
};

export default async function SavedPaymentTermsPage() {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("paymentTerms");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (!canAccess) {
    redirect("/dashboard");
  }

  const artifacts = await prisma.jobArtifact.findMany({
    where: {
      sourceApp: "PAYMENT_TERM",
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const rows: SavedPaymentTermRow[] = artifacts.map((artifact) => {
    const meta =
      artifact.metadata && typeof artifact.metadata === "object"
        ? (artifact.metadata as Record<string, unknown>)
        : {};

    const paymentTermNumber =
      typeof meta.paymentTermNumber === "string"
        ? meta.paymentTermNumber
        : artifact.id;

    return {
      id: artifact.id,
      paymentTermNumber,
      revNum: typeof meta.revNum === "string" ? meta.revNum : "1",
      title: artifact.title,
      customerName:
        typeof meta.customerName === "string" ? meta.customerName : "-",
      dealName: typeof meta.dealName === "string" ? meta.dealName : "-",
      address: typeof meta.address === "string" ? meta.address : null,
      salesRep: typeof meta.salesRep === "string" ? meta.salesRep : null,
      showInCustomerFiles: meta.showInCustomerFiles === true,
      createdAt: artifact.createdAt.toISOString(),
    };
  });

  return (
    <SavedPaymentTermsClient
      rows={rows}
      currentUserName={user.name?.trim() || ""}
      canDelete={appRole === "admin"}
    />
  );
}
