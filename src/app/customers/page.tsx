import { redirect } from "next/navigation";

// The old "Customer Directory" program has been retired in favor of
// Customers (/customers-v2), which covers everything this program did
// (QuickBooks Sync moved to /customers-v2/quickbooks-sync). This route is
// kept only so old links/bookmarks land somewhere useful instead of 404ing.
export default function CustomersRedirectPage() {
  redirect("/customers-v2");
}
