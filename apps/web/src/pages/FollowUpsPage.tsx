import { useEffect, useState } from "react";

import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { fetchFollowUps, markFollowUpDone, snoozeFollowUp } from "../lib/api";
import { formatDateTime, formatRelativeMinutes } from "../lib/format";
import type { FollowUp } from "../lib/types";

export function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadFollowUps() {
    try {
      setLoading(true);
      const nextFollowUps = await fetchFollowUps();
      setFollowUps(nextFollowUps);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load follow-ups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFollowUps();
  }, []);

  async function handleDone(followUpId: string) {
    try {
      await markFollowUpDone(followUpId);
      await loadFollowUps();
    } catch (doneError) {
      setError(doneError instanceof Error ? doneError.message : "Failed to mark follow-up done.");
    }
  }

  async function handleSnooze(followUpId: string) {
    try {
      await snoozeFollowUp(followUpId, 24);
      await loadFollowUps();
    } catch (snoozeError) {
      setError(snoozeError instanceof Error ? snoozeError.message : "Failed to snooze follow-up.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Follow-ups"
        title="Stay ahead of unapproved quotes and overdue invoices"
        description="Follow-up rows are created by Phase 5.2 step 9 and worked through here, with manual snooze and done actions for the sales team."
      />

      {loading ? <LoadingState label="Loading follow-up reminders..." /> : null}
      {error ? <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">{error}</div> : null}

      {!loading && !followUps.length ? (
        <EmptyState
          title="No follow-ups are scheduled"
          description="Once the approval timeout or payment reminder logic runs, reminders created in `follow_ups` will show up here."
        />
      ) : null}

      <div className="grid gap-4">
        {followUps.map((followUp) => (
          <SectionCard
            key={followUp.id}
            eyebrow={followUp.customer?.name ?? followUp.customer?.whatsapp_phone ?? "Unknown customer"}
            title={followUp.reason ?? "No reason provided"}
            actions={<StatusBadge value={followUp.done ? "done" : "pending"} />}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2 text-sm leading-7 text-mist/80">
                <p>Reminder time: {formatDateTime(followUp.remind_at)}</p>
                <p>Status window: {formatRelativeMinutes(followUp.remind_at)}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-secondary" onClick={() => handleSnooze(followUp.id)}>
                  Snooze 24h
                </button>
                <button type="button" className="btn-primary" onClick={() => handleDone(followUp.id)} disabled={followUp.done}>
                  Mark done
                </button>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
