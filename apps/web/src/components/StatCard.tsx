export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass-panel p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-mist/55">{label}</p>
      <p className="mt-4 font-display text-3xl text-white">{value}</p>
      <p className="mt-2 text-sm text-mist/70">{hint}</p>
    </div>
  );
}
