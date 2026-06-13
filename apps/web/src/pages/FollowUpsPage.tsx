import { useEffect, useState } from "react";

import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { fetchFollowUps, markFollowUpDone, snoozeFollowUp } from "../lib/api";
import { safeArray } from "../lib/arrays";
import { getErrorMessage } from "../lib/errors";
import { formatDateTime, formatRelativeMinutes } from "../lib/format";
import type { FollowUp } from "../lib/types";

export function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"done" | "snooze" | null>(null);
  const visibleFollowUps = safeArray<FollowUp>(followUps);

  async function loadFollowUps() {
    try {
      setLoading(true);
      const nextFollowUps = await fetchFollowUps();
      setFollowUps(nextFollowUps);
      setError(null);
    } catch (loadError) {
      console.error("Error:", loadError);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFollowUps();
  }, []);

  async function handleDone(followUpId: string) {
    try {
      setBusyId(followUpId);
      setBusyAction("done");
      setError(null);
      await markFollowUpDone(followUpId);
      await loadFollowUps();
    } catch (doneError) {
      console.error("Error:", doneError);
      setError(getErrorMessage(doneError));
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleSnooze(followUpId: string) {
    try {
      setBusyId(followUpId);
      setBusyAction("snooze");
      setError(null);
      await snoozeFollowUp(followUpId, 24);
      await loadFollowUps();
    } catch (snoozeError) {
      console.error("Error:", snoozeError);
      setError(getErrorMessage(snoozeError));
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Follow-ups"
        title="Stay ahead of unapproved quotes and overdue invoices"
        description="Follow-up rows are created by Phase 5.2 step 9 and worked through here, with manual snooze and done actions for the sales team."
      />

      {loading && !visibleFollowUps.length ? <LoadingState label="Loading follow-up reminders..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && !visibleFollowUps.length ? (
        <EmptyState
          title="No follow-ups are scheduled"
          description="Once the approval timeout or payment reminder logic runs, reminders created in `follow_ups` will show up here."
        />
      ) : null}

      <div className="grid gap-4">
        {visibleFollowUps.map((followUp) => (
          <SectionCard
            key={followUp.id}
            eyebrow={followUp.customer?.name ?? followUp.customer?.whatsapp_phone ?? "Unknown customer"}
            title={followUp.reason ?? "No reason provided"}
            actions={<StatusBadge value={followUp.done ? "done" : "pending"} />}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2 text-sm leading-7 text-mist/80">
                <p>Customer phone: {followUp.customer?.whatsapp_phone ?? "Not available"}</p>
                <p>Reminder time: {formatDateTime(followUp.remind_at)}</p>
                <p>Status window: {formatRelativeMinutes(followUp.remind_at)}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleSnooze(followUp.id)}
                  disabled={busyId === followUp.id}
                >
                  {busyId === followUp.id && busyAction === "snooze" ? "Working..." : "Snooze 24h"}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleDone(followUp.id)}
                  disabled={followUp.done || busyId === followUp.id}
                >
                  {busyId === followUp.id && busyAction === "done" ? "Saving..." : "Mark done"}
                </button>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
