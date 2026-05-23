const STATUS_STYLES: Record<string, string> = {
  draft: "border-gold/30 bg-gold/12 text-gold",
  approved: "border-mint/30 bg-mint/12 text-mint",
  sent: "border-coral/30 bg-coral/12 text-coral",
  rejected: "border-rose-400/30 bg-rose-400/12 text-rose-300",
  paid: "border-mint/30 bg-mint/12 text-mint",
  overdue: "border-rose-400/30 bg-rose-400/12 text-rose-300",
  done: "border-mint/30 bg-mint/12 text-mint",
  pending: "border-mist/20 bg-white/5 text-mist",
};

export function StatusBadge({ value }: { value: string }) {
  const tone = STATUS_STYLES[value] ?? STATUS_STYLES.pending;

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${tone}`}>
      {value}
    </span>
  );
}
