import { NavLink } from "react-router-dom";

import { safeArray } from "../lib/arrays";

const links = [
  { to: "/inbox", label: "Inbox" },
  { to: "/quotations", label: "Quotations" },
  { to: "/customers", label: "Customers" },
  { to: "/products", label: "Products" },
  { to: "/invoices", label: "Invoices" },
  { to: "/follow-ups", label: "Follow-ups" },
  { to: "/analytics", label: "Analytics" },
];

const navigationLinks = safeArray<(typeof links)[number]>(links);

export function Sidebar() {
  return (
    <aside className="glass-panel flex h-full flex-col p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.38em] text-coral">OrderPilot</p>
        <h1 className="mt-3 font-display text-3xl text-white">Sales OS</h1>
        <p className="mt-3 text-sm leading-7 text-mist/75">
          WhatsApp intake, AI extraction, quotation approval, invoicing, and follow-ups in one flow.
        </p>
      </div>

      <nav className="mt-8 space-y-2">
        {navigationLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              [
                "block rounded-2xl px-4 py-3 text-sm font-medium transition",
                isActive ? "bg-white text-ink" : "bg-white/5 text-mist hover:bg-white/10 hover:text-white",
              ].join(" ")
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-3xl border border-coral/20 bg-coral/10 p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-coral">System Flow</p>
        <p className="mt-3 text-sm leading-7 text-mist/85">
          WhatsApp to Interakt, then Supabase Edge Functions, AI, n8n, and finally the dashboard.
        </p>
      </div>
    </aside>
  );
}
