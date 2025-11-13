import ResetConfirmForm from "./ResetConfirmForm";

export default function Page({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token || "";
  return (
    <main className="min-h-screen w-full grid place-items-center p-4">
      <ResetConfirmForm token={token} />
    </main>
  );
}
