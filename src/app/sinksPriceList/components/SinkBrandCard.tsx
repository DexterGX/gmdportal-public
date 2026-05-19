import Link from "next/link";

type Props = {
  id: string;
  name: string;
  logoUrl: string | null;
  availableCount: number;
};

export default function SinkBrandCard({
  id,
  name,
  logoUrl,
  availableCount,
}: Props) {
  return (
    <Link
      href={`/sinksPriceList/brand/${id}`}
      className="flex items-center gap-6 rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-8 py-6 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-gray-600 transition"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50 dark:bg-gray-700 overflow-hidden flex-shrink-0">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${name} logo`}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-3xl font-semibold text-slate-500 dark:text-gray-400">
            {name?.charAt(0).toUpperCase() ?? "?"}
          </span>
        )}
      </div>

      <div className="flex flex-col">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
          {name}
        </h3>
        <span className="mt-2 text-sm font-medium text-sky-600 dark:text-blue-400">
          {availableCount} sinks available
        </span>
      </div>
    </Link>
  );
}
