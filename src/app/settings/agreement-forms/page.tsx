import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import AgreementFormsSettingsClient from "./AgreementFormsSettingsClient";

const prismaAny = prisma as any;

const DEFAULT_AGREEMENT_FORMS = [
  {
    key: "cabinet_agreement",
    title: "Cabinet Agreement",
    content: "",
    isActive: true,
    sortOrder: 20,
  },
  {
    key: "countertop_agreement",
    title: "Countertop Agreement",
    content: "",
    isActive: true,
    sortOrder: 30,
  },
  {
    key: "repair_agreement",
    title: "Repair Agreement",
    content: "",
    isActive: true,
    sortOrder: 40,
  },
  {
    key: "honed_agreement",
    title: "Honed Agreement",
    content: "",
    isActive: true,
    sortOrder: 50,
  },
];

export default async function AgreementFormsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/settings/agreement-forms");
  }

  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole !== "admin") {
    redirect("/settings");
  }

  for (const template of DEFAULT_AGREEMENT_FORMS) {
    await prismaAny.agreementFormTemplate.upsert({
      where: { key: template.key },
      create: template,
      update: {},
    });
  }

  const templates = await prismaAny.agreementFormTemplate.findMany({
    where: { key: { not: "payment_term" } },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });

  return (
    <AgreementFormsSettingsClient
      initialTemplates={templates.map((row: any) => ({
        id: row.id,
        key: row.key,
        title: row.title,
        content: row.content,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        updatedAt: row.updatedAt.toISOString(),
      }))}
    />
  );
}
