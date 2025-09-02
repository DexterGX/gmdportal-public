// app/dashboard/page.tsx
import { getServerSession } from "next-auth";
import authOptions from "../../lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/dashboard");
  }
  const user = session.user;

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <a
          href="/api/auth/signout?callbackUrl=/"
          className="rounded-lg bg-neutral-800 px-4 py-2 text-sm"
        >
          Sign out
        </a>
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Estimates" href="/estimates" desc="Create and manage estimates." />
        <Card title="Price Tables" href="/prices" desc="Update cabinet/countertop pricing." />
        <Card title="Orders" href="/orders" desc="Track orders and installs." />
      </section>

      <p className="mt-8 text-neutral-400 text-sm">Signed in as {user?.email}</p>
    </main>
  );
}

function Card({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a
      href={href}
      className="block rounded-2xl bg-neutral-900 p-6 ring-1 ring-neutral-800 hover:ring-neutral-700 transition"
    >
      <h2 className="text-lg font-medium mb-2">{title}</h2>
      <p className="text-neutral-400 text-sm">{desc}</p>
    </a>
  );
}
