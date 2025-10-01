// app/dashboard/page.tsx
import StatCard from "../../components/StatCard";
import Chart from "../../components/Chart";

export default function DashboardPage() {
  return (
    <div className="space-y-6 w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Customers" value="3,782" change="+11.01%" />
        <StatCard title="Orders" value="5,359" change="-9.05%" />
        <StatCard title="Revenue" value="$20K" change="+3.2%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        <div className="lg:col-span-2 w-full">
          <Chart />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-semibold mb-4">Monthly Target</h3>
          <div className="text-center text-3xl font-bold text-gray-900">
            75.55%
          </div>
          <p className="text-sm text-gray-500 mt-2">
            You earn $3287 today, it&#39;s higher than last month.
          </p>
        </div>
      </div>
    </div>
  );
}
