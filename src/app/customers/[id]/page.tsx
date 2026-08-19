import { redirect } from "next/navigation";

// See app/customers/page.tsx — the old Customer Directory program has been
// retired in favor of Customers (/customers-v2), which has the equivalent
// detail page. Redirecting instead of removing this route so old
// links/bookmarks to a specific customer still land somewhere useful.
export default async function CustomerRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/customers-v2/${id}`);
}
