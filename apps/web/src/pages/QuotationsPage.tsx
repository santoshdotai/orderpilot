import { useEffect, useState } from "react";

import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { approveAndSendQuotation, fetchQuotations } from "../lib/api";
import { formatCurrency, formatDateTime } from "../lib/format";
import type { Quotation } from "../lib/types";

export function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadQuotations() {
    try {
      setLoading(true);
      const nextQuotations = await fetchQuotations();
      setQuotations(nextQuotations);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quotations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuotations();
  }, []);

  async function handleApprove(quotationId: string) {
    try {
      setSubmittingId(quotationId);
      setError(null);
      await approveAndSendQuotation(quotationId);
      await loadQuotations();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Failed to approve quotation.");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Quotations"
        title="Review, approve, and trigger delivery"
        description="Phase 5.3 and Phase 6.3 come together here: sales reps validate line items, approve quotations, and fire the n8n approval workflow."
      />

      {loading ? <LoadingState label="Loading quotation drafts and line items..." /> : null}
      {error ? <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div> : null}

      {!loading && !quotations.length ? (
        <EmptyState
          title="No quotation drafts yet"
          description="Send a WhatsApp order through the Twilio intake flow and let Phase 5.2 create the first draft quotation."
        />
      ) : null}

      <div className="grid gap-4">
        {quotations.map((quotation) => (
          <SectionCard
            key={quotation.id}
            eyebrow={quotation.customer?.name ?? quotation.customer?.whatsapp_phone ?? "Unknown customer"}
            title={`Quotation ${quotation.id.slice(0, 8)}`}
            actions={
              <div className="flex items-center gap-3">
                <StatusBadge value={quotation.status} />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleApprove(quotation.id)}
                  disabled={quotation.status !== "draft" || submittingId === quotation.id}
                >
                  {submittingId === quotation.id ? "Sending..." : "Approve & Send"}
                </button>
              </div>
            }
          >
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Created</p>
                    <p className="mt-3 text-sm text-white">{formatDateTime(quotation.created_at)}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Customer</p>
                    <p className="mt-3 text-sm text-white">
                      {quotation.customer?.name ?? quotation.customer?.whatsapp_phone ?? "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-3xl border border-white/10">
                  <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-3 font-medium text-mist/70">Product</th>
                        <th className="px-4 py-3 font-medium text-mist/70">Qty</th>
                        <th className="px-4 py-3 font-medium text-mist/70">Unit price</th>
                        <th className="px-4 py-3 font-medium text-mist/70">Line total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-panel/40">
                      {quotation.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-white">{item.product?.name ?? "Custom line item"}</td>
                          <td className="px-4 py-3 text-mist/80">{item.qty}</td>
                          <td className="px-4 py-3 text-mist/80">{formatCurrency(item.unit_price)}</td>
                          <td className="px-4 py-3 text-white">{formatCurrency(item.qty * item.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Quote total</p>
                  <p className="mt-4 font-display text-4xl text-white">{formatCurrency(quotation.total)}</p>
                  <p className="mt-3 text-sm leading-7 text-mist/75">
                    Phase 5.2 step 7 prices the draft from the `products` catalog before the sales team reviews it here.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Approval automation</p>
                  <p className="mt-3 text-sm leading-7 text-mist/78">
                    On approval, the dashboard posts `quotationId` to the n8n webhook defined by `VITE_N8N_APPROVAL_WEBHOOK_URL`, which then sends the quotation and can call the invoice engine.
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
