import type { Session } from "@supabase/supabase-js";
import { Outlet, useNavigate } from "react-router-dom";

import { Sidebar } from "../components/Sidebar";
import { supabase } from "../lib/supabase";

export function AppShell({ session }: { session: Session | null }) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-hero-mesh px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Sidebar />

        <div className="glass-panel flex min-h-full flex-col overflow-hidden">
          <header className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold">AI Sales Operating System</p>
              <p className="mt-2 text-sm text-mist/75">
                WhatsApp → Twilio → Supabase Edge Fn → DB → AI → n8n → Dashboard
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="pill">{session?.user.email ?? "Authenticated sales rep"}</span>
              <button type="button" className="btn-secondary" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
