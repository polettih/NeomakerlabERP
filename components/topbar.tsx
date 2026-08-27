import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function Topbar() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return (
    <header className="topbar">
      <strong>NeoMaker ERP</strong>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="muted">{data.user?.email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
