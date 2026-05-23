import { useEffect, useState } from "react";

import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { fetchCustomers } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { Customer } from "../lib/types";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCustomers() {
      try {
        setLoading(true);
        const nextCustomers = await fetchCustomers();
        setCustomers(nextCustomers);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load customers.");
      } finally {
        setLoading(false);
      }
    }

    loadCustomers();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Every WhatsApp lead in one place"
        description="Customer records are created in Phase 3.2 when the Twilio webhook upserts `customers` before saving inbound messages."
      />

      {loading ? <LoadingState label="Loading customer directory..." /> : null}
      {error ? <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div> : null}

      {!loading && !customers.length ? (
        <EmptyState
          title="No customers yet"
          description="The customer list fills automatically as WhatsApp orders arrive through the Twilio Sandbox or production sender."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {customers.map((customer) => (
          <SectionCard
            key={customer.id}
            eyebrow={customer.segment ?? "unclassified"}
            title={customer.name ?? customer.whatsapp_phone}
          >
            <div className="space-y-3 text-sm text-mist/78">
              <p>
                <span className="text-mist/55">Phone:</span> {customer.whatsapp_phone}
              </p>
              <p>
                <span className="text-mist/55">Language:</span> {customer.language ?? "en"}
              </p>
              <p>
                <span className="text-mist/55">Created:</span> {formatDateTime(customer.created_at)}
              </p>
            </div>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
