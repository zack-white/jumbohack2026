import Link from "next/link";
import { PingPointDashboard } from "@/components/dashboard/PingPointDashboard";

export default function DashboardPage() {
  return (
    <div className="dark flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-4 border-b px-6 py-4">
        <Link href="/" className="text-sky-400 text-xl font-semibold hover:underline">
          PingPoint
        </Link>
        <nav className="flex gap-4">
          <Link href="/dashboard" className="text-muted-foreground text-sm hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/" className="text-muted-foreground text-sm hover:text-foreground">
            Scanner
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6">
        <PingPointDashboard />
      </main>
    </div>
  );
}
