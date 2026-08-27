export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <Topbar />
        {children}
      </main>
    </div>
  );
}
