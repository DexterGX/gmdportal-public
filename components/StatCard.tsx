// components/StatCard.tsx
interface StatCardProps {
  title: string;
  value: string;
  change?: string;
}

export default function StatCard({ title, value, change }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col">
      <span className="text-sm text-gray-500">{title}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {change && (
        <span
          className={`text-sm font-medium ${
            change.startsWith("+") ? "text-green-600" : "text-red-600"
          }`}
        >
          {change}
        </span>
      )}
    </div>
  );
}
