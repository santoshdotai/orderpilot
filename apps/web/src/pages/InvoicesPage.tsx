import { useEffect, useState } from "react";

import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { fetchInvoices } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import { formatCurrency, formatDateTime } from "../lib/format";
import type { Invoice } from "../lib/types";

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadInvoices() {
    try {
      setLoading(true);
      const nextInvoices = await fetchInvoices();
      setInvoices(nextInvoices);
      setError(null);
    } catch (loadError) {
      console.error("Error:", loadError);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Invoices"
        title="Track invoice delivery and collection status"
        description="Invoices generated downstream in n8n and Supabase show up here so the sales team can confirm totals, customer details, and payment follow-through."
      />

      {loading && !invoices.length ? <LoadingState label="Loading invoices..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && !invoices.length ? (
        <EmptyState
          title="No invoices yet"
          description="Approved quotations and downstream automation will create invoice rows here once the sales flow starts generating payable orders."
        />
      ) : null}

      <div className="grid gap-4">
        {invoices.map((invoice) => (
          <SectionCard
            key={invoice.id}
            eyebrow={invoice.customer?.name ?? invoice.customer?.whatsapp_phone ?? "Unknown customer"}
            title={invoice.invoice_number ?? `Invoice ${invoice.id.slice(0, 8)}`}
            actions={<StatusBadge value={invoice.status ?? "pending"} />}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Customer phone</p>
                <p className="mt-3 text-sm text-white">{invoice.customer?.whatsapp_phone ?? "Not available"}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Invoice total</p>
                <p className="mt-3 text-sm text-white">{formatCurrency(invoice.total)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Tax</p>
                <p className="mt-3 text-sm text-white">{formatCurrency(invoice.tax)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Due date</p>
                <p className="mt-3 text-sm text-white">{formatDateTime(invoice.due_date)}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 text-sm text-mist/80 md:flex-row md:items-center md:justify-between">
              <p>Created: {formatDateTime(invoice.created_at)}</p>
              {invoice.pdf_url ? (
                <a
                  className="btn-secondary inline-flex items-center justify-center"
                  href={invoice.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open PDF
                </a>
              ) : (
                <p>PDF not available yet</p>
              )}
            </div>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
