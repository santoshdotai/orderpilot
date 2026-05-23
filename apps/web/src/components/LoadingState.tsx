export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-mist/75">
      {label}
    </div>
  );
}
