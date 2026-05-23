import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { AppShell } from "./layouts/AppShell";
import { supabase } from "./lib/supabase";
import { LoginPage } from "./pages/LoginPage";
import { InboxPage } from "./pages/InboxPage";
import { QuotationsPage } from "./pages/QuotationsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ProductsPage } from "./pages/ProductsPage";
import { FollowUpsPage } from "./pages/FollowUpsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";

function ProtectedRoute({ session }: { session: Session | null }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero-mesh px-6">
        <div className="glass-panel w-full max-w-md p-8 text-center">
          <p className="text-sm uppercase tracking-[0.32em] text-coral">OrderPilot</p>
          <h1 className="mt-4 font-display text-3xl text-white">Loading your sales cockpit</h1>
          <p className="mt-3 text-sm text-mist/80">
            Connecting WhatsApp, Supabase, AI, and automation layers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage session={session} />} />
        <Route element={<ProtectedRoute session={session} />}>
          <Route element={<AppShell session={session} />}>
            <Route index element={<Navigate to="/inbox" replace />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/quotations" element={<QuotationsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/follow-ups" element={<FollowUpsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
