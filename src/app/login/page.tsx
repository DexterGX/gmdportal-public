import Image from "next/image";
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
            <Image
              src="/logo.svg"
              alt="GM Design"
              width={360}
              height={360}
              className="mb-2"
              priority
            />
          </div>
        </div>
      </div>
    </main>
  );
}
