export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-mist/75">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-coral" />
      <p className="mt-4">{label}</p>
    </div>
  );
}
