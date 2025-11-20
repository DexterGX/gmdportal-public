import LoginForm from "./ui/LoginForm";

export default function Page({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  return (
    <main className="min-h-screen w-full p-4">
      <div className="w-full grid grid-cols-1 md:grid-cols-2">
        <div className="min-h-screen flex items-center justify-center px-6 md:px-12 md:border-r md:border-neutral-200 dark:md:border-neutral-800">
          <LoginForm reason={searchParams.reason} />
        </div>

        <div className="hidden md:flex min-h-screen items-center justify-center px-6 md:px-12">
          <div className="flex flex-col items-center justify-center p-8">
            <img
              src="/logo.svg"
              alt="GM Design"
              className="h-90 md:h-90 mb-2"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
