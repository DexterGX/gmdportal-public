import ResetConfirmForm from "./ResetConfirmForm";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="min-h-screen w-full grid place-items-center p-4">
      <ResetConfirmForm token={token || ""} />
    </main>
  );
}
