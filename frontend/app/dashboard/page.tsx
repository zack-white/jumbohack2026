import Link from "next/link";
import { PingPointDashboard } from "@/components/dashboard/PingPointDashboard";

export default function DashboardPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-4 border-b px-6 py-4">
        <Link href="/" className="text-sky-400 text-xl font-semibold hover:underline">
          PingPoint
        </Link>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-6">
        <PingPointDashboard />
      </main>
    </div>
  );
}
