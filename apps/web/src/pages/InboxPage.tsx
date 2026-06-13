import { useEffect, useState } from "react";

import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { enrichInboxMessages, fetchInboxMessages } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import { formatDateTime } from "../lib/format";
import { parseJsonArray, safeArray } from "../lib/arrays";
import { supabase } from "../lib/supabase";
import type { AIExtractionProduct, InboxMessage, MessageRecord } from "../lib/types";

function renderProducts(message: InboxMessage) {
  const products = parseJsonArray<AIExtractionProduct>(message.aiExtraction?.products);

  if (!Array.isArray(products) || products.length === 0) {
    return <span className="text-mist/60">No products</span>;
  }

  return products
    .map((product) => {
      const name = typeof product.name === "string" && product.name.trim() ? product.name : "Unknown product";
      const qty = Number(product.qty ?? 0);

      return `${name} x ${Number.isFinite(qty) ? qty : 0}`;
    })
    .join(", ");
}

export function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const visibleMessages = safeArray<InboxMessage>(messages);

  useEffect(() => {
    let mounted = true;

    async function loadMessages() {
      try {
        setLoading(true);
        const nextMessages = await fetchInboxMessages();
        if (mounted) {
          setMessages(nextMessages);
          setError(null);
        }
      } catch (loadError) {
        if (mounted) {
          console.error("Error:", loadError);
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadMessages();

    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          try {
            const [nextMessage] = await enrichInboxMessages([payload.new as MessageRecord]);

            if (!mounted || !nextMessage) {
              return;
            }

            setMessages((current) => {
              const filtered = safeArray<InboxMessage>(current).filter((message) => message.id !== nextMessage.id);
              return [nextMessage, ...filtered].slice(0, 50);
            });
          } catch (subscriptionError) {
            console.error("Error:", subscriptionError);
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Live WhatsApp order intake"
        description="Phase 6.3 inbox view for inbound messages, voice-note transcripts, and AI extraction status across the intake pipeline."
      />

      {loading && !visibleMessages.length ? <LoadingState label="Pulling the latest WhatsApp messages from Supabase..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && !visibleMessages.length ? (
        <EmptyState
          title="No inbound orders yet"
          description="Complete Phase 3 and Phase 5, then send a WhatsApp message through Interakt to populate the inbox."
        />
      ) : null}

      <div className="grid gap-4">
        {visibleMessages.map((message) => (
          <SectionCard
            key={message.id}
            eyebrow={message.customer?.name ?? message.customer?.whatsapp_phone ?? "Unknown customer"}
            title={message.body?.trim() ? message.body : "Voice note / media message"}
            actions={<StatusBadge value={message.aiExtraction?.urgency ?? "pending"} />}
          >
            <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Received</p>
                    <p className="mt-3 text-sm text-white">{formatDateTime(message.created_at)}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Customer phone</p>
                    <p className="mt-3 text-sm text-white">{message.customer?.whatsapp_phone ?? "Not available"}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Direction</p>
                    <p className="mt-3 text-sm text-white">{message.direction === "in" ? "Inbound" : "Outbound"}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Transcript</p>
                  <p className="mt-3 text-sm leading-7 text-mist/85">
                    {message.transcription?.text ?? "No transcript stored yet."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Extracted products</p>
                  <p className="mt-3 text-sm leading-7 text-white">{renderProducts(message)}</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-mist/55">Delivery details</p>
                  <p className="mt-3 text-sm leading-7 text-mist/80">
                    {message.aiExtraction?.delivery?.address ?? "No delivery address extracted yet"}
                  </p>
                  <p className="mt-2 text-sm text-mist/60">
                    {message.aiExtraction?.delivery?.date ? `Requested date: ${message.aiExtraction.delivery.date}` : "No delivery date requested"}
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
