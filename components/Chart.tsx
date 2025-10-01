// components/Chart.tsx
"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const data = [
  { month: "Jan", sales: 120 },
  { month: "Feb", sales: 300 },
  { month: "Mar", sales: 180 },
  { month: "Apr", sales: 220 },
  { month: "May", sales: 170 },
  { month: "Jun", sales: 250 },
];

export default function Chart() {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="font-semibold mb-4">Monthly Sales</h3>
      <LineChart width={600} height={250} data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="sales"
          stroke="#4F46E5"
          strokeWidth={2}
        />
      </LineChart>
    </div>
  );
}
