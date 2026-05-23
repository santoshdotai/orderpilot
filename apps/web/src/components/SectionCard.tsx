import type { ReactNode } from "react";

export function SectionCard({
  title,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="glass-panel p-6">
      <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          {eyebrow ? <p className="text-xs uppercase tracking-[0.3em] text-mint">{eyebrow}</p> : null}
          <h2 className="mt-2 font-display text-xl text-white">{title}</h2>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
