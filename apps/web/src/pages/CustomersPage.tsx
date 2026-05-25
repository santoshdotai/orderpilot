import { useEffect, useState } from "react";

import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { fetchCustomers } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import type { Customer } from "../lib/types";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCustomers() {
    try {
      setLoading(true);
      const nextCustomers = await fetchCustomers();
      setCustomers(nextCustomers);
      setError(null);
    } catch (loadError) {
      console.error("Error:", loadError);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Every WhatsApp lead in one place"
        description="Customer records are created in Phase 3.2 when the Twilio webhook upserts `customers` before saving inbound messages."
      />

      {loading && !customers.length ? <LoadingState label="Loading customer directory..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && !customers.length ? (
        <EmptyState
          title="No customers yet"
          description="The customer list fills automatically as WhatsApp orders arrive through the Twilio Sandbox or production sender."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {customers.map((customer) => (
          <SectionCard
            key={customer.id}
            eyebrow={customer.language ?? "customer"}
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
