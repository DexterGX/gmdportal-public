import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { getInstallers } from "@/lib/users";
import NewQuoteForm from "./NewQuoteForm";

type NewQuotePageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function NewQuotePage(props: NewQuotePageProps) {
  const { jobId } = await props.params;
  const { user, appRole, isActive } = await getProgramUserContext("closetJobs");

  if (!user || !isActive) {
    redirect("/login");
  }

  // Only installer or admin can access
  if (!["installer", "admin"].includes(appRole)) {
    redirect("/closet-jobs");
  }

  // Verify job exists
  const job = await prisma.closetJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      quoteNumber: true,
      installerId: true,
      customerName: true,
      propertyAddress: true,
      area: true,
    },
  });

  if (!job) {
    redirect("/closet-jobs");
  }

  // If installer, verify they are assigned to this job
  if (appRole === "installer" && job.installerId !== user.id) {
    redirect(`/closet-jobs/${jobId}`);
  }

  // Fetch installers list for admin
  const installers = appRole === "admin" ? await getInstallers() : [];

  return <NewQuoteForm job={job} userRole={appRole} installers={installers} />;
}
