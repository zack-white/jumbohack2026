import Link from "next/link";
import PiScannerPanel from "@/components/PiScannerPanel";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-background py-12">
      <Link href="/dashboard" className="mb-6 text-sky-400 hover:underline">
        → PingPoint Dashboard
      </Link>
      <PiScannerPanel />
    </main>
  );
}
