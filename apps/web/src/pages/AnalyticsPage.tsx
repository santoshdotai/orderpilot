import { useEffect, useState } from "react";

import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { fetchAnalytics } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import type { AnalyticsSnapshot } from "../lib/types";

export function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true);
        const snapshot = await fetchAnalytics();
        setAnalytics(snapshot);
        setError(null);
      } catch (loadError) {
        console.error("Error:", loadError);
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Track the full sales workflow"
        description="This screen ties back to the business goal in the Readme by measuring order capture, quotation throughput, revenue, and follow-up load."
      />

      {loading && !analytics ? <LoadingState label="Computing analytics snapshot..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && !analytics ? (
        <EmptyState title="No data yet" description="As messages, quotations, invoices, and payments land in Supabase, the sales snapshot will populate here." />
      ) : null}

      {analytics ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Inbound messages" value={String(analytics.inboundMessages)} hint="Phase 3 intake health" />
            <StatCard label="Draft quotes" value={String(analytics.draftQuotes)} hint="Needs human review" />
            <StatCard label="Approved quotes" value={String(analytics.approvedQuotes)} hint="Ready for delivery" />
            <StatCard label="Sent quotes" value={String(analytics.sentQuotes)} hint="Already pushed to customers" />
            <StatCard label="Confirmed orders" value={String(analytics.confirmedOrders)} hint="Order confirmations recorded" />
            <StatCard label="Open follow-ups" value={String(analytics.openFollowUps)} hint="Manual or automated nudges due" />
          </div>

          <SectionCard title="Revenue signals" eyebrow="Invoices and payments">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-mist/55">Invoiced revenue</p>
                <p className="mt-4 font-display text-3xl text-white">{formatCurrency(analytics.invoicedRevenue)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-mist/55">Paid revenue</p>
                <p className="mt-4 font-display text-3xl text-white">{formatCurrency(analytics.paidRevenue)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-mist/55">Overdue invoices</p>
                <p className="mt-4 font-display text-3xl text-white">{analytics.overdueInvoices}</p>
              </div>
            </div>
          </SectionCard>
        </>
      ) : null}
    </>
  );
}
