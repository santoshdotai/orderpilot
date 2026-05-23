import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";

export function LoginPage({ session }: { session: Session | null }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      navigate("/inbox", { replace: true });
    }
  }, [navigate, session]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate("/inbox", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero-mesh px-6">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="glass-panel p-10">
          <p className="text-xs uppercase tracking-[0.36em] text-coral">OrderPilot</p>
          <h1 className="mt-5 font-display text-5xl leading-tight text-white">
            The AI sales operating system for WhatsApp-first businesses.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-mist/78">
            Route inbound text and voice-note orders through AI extraction, quotation review, invoice delivery, and
            follow-up automation without leaving your sales dashboard.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              "Capture every order from WhatsApp in real time",
              "Draft quotations automatically from AI extractions",
              "Trigger invoices and reminders through n8n workflows",
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-mist/80">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel p-8">
          <p className="text-xs uppercase tracking-[0.36em] text-gold">Sales Team Access</p>
          <h2 className="mt-4 font-display text-3xl text-white">Sign in</h2>
          <p className="mt-3 text-sm leading-7 text-mist/70">
            Use the Supabase Auth account created in Phase 2.4 to review quotations and manage follow-ups.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm text-mist/80">Email</span>
              <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-mist/80">Password</span>
              <input
                className="field"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Signing in..." : "Enter dashboard"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
