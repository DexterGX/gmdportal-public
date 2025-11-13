import React from "react";

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

export default function AuthPageTemplate({ children, title, subtitle }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="hidden md:flex items-center justify-center bg-gradient-to-b from-blue-600 to-indigo-600 text-white rounded-2xl p-8">
          <div>
            <h2 className="text-3xl font-bold">{title ?? "Welcome"}</h2>
            {subtitle && <p className="mt-2">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center justify-center">{children}</div>
      </div>
    </div>
  );
}
