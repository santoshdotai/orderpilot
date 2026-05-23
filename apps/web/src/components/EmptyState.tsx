export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center">
      <h3 className="font-display text-xl text-white">{title}</h3>
      <p className="mt-3 text-sm text-mist/70">{description}</p>
    </div>
  );
}
