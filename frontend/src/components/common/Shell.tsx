import { motion } from "framer-motion";
import { BarChart3, Cpu, Flame, Inbox, LayoutDashboard, Settings, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/", label: "Overview", Icon: LayoutDashboard },
  { to: "/queue", label: "Application Queue", Icon: Inbox },
  { to: "/intake", label: "New Application", Icon: Sparkles },
  { to: "/agents", label: "Experts", Icon: Cpu },
  { to: "/portfolio", label: "Portfolio", Icon: BarChart3 },
  { to: "/escalations", label: "Escalations", Icon: Flame },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 flex min-h-screen text-slate-100">
      <aside className="w-60 shrink-0 border-r border-white/5 bg-slate-950/40 backdrop-blur-xl p-4 flex flex-col">
        <div className="flex items-center gap-2 px-2 py-3">
          <motion.div
            className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center shadow-lg shadow-indigo-500/40"
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="w-5 h-5" />
          </motion.div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Arbiter</div>
            <div className="text-[11px] text-slate-400">Agentic Underwriting</div>
          </div>
        </div>

        <nav className="mt-6 space-y-1">
          {ITEMS.map(({ to, label, Icon }, i) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`
              }
              end={to === "/"}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-gradient-to-b from-indigo-400 to-fuchsia-400"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/10 ring-1 ring-white/10 p-3 relative overflow-hidden">
          <div className="text-[11px] text-slate-300">Expert Desk v1</div>
          <div className="text-xs font-semibold text-white mt-0.5">6 experts · 1 lead · 1 governor</div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
