import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Cpu, Flame, Inbox, LayoutDashboard, Moon, Settings, Sparkles, Sun } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useApplyTheme, useThemeStore } from "../../hooks/useTheme";

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
  useApplyTheme();
  return (
    <div className="relative z-10 flex min-h-screen text-slate-900 dark:text-slate-100">
      <aside className="w-60 shrink-0 border-r border-slate-900/[0.05] dark:border-white/5 bg-white/70 dark:bg-slate-950/40 backdrop-blur-xl p-4 flex flex-col">
        <div className="flex items-center gap-2 px-2 py-3">
          <motion.div
            className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center shadow-lg shadow-indigo-500/40 text-white"
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="w-5 h-5" />
          </motion.div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Arbiter</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Agentic Underwriting</div>
          </div>
        </div>

        <nav className="mt-6 space-y-1">
          {ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/5"
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

        <div className="mt-auto space-y-2">
          <ThemeToggle />
          <div className="rounded-xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/10 ring-1 ring-slate-900/10 dark:ring-white/10 p-3 relative overflow-hidden">
            <div className="text-[11px] text-slate-700 dark:text-slate-300">Expert Desk v1</div>
            <div className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5">6 experts · 1 lead · 1 governor</div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-900/[0.05] dark:bg-white/5 ring-1 ring-slate-900/10 dark:ring-white/10 hover:bg-slate-900/10 dark:hover:bg-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
    >
      <span className="relative w-6 h-6 rounded-lg grid place-items-center bg-gradient-to-br from-amber-300/30 to-indigo-500/30 ring-1 ring-slate-900/10 dark:ring-white/10 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.span
              key="moon"
              initial={{ y: -14, opacity: 0, rotate: -30 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: 14, opacity: 0, rotate: 30 }}
              transition={{ type: "spring", stiffness: 360, damping: 22 }}
              className="absolute text-indigo-200"
            >
              <Moon className="w-3.5 h-3.5" />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              initial={{ y: -14, opacity: 0, rotate: -30 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: 14, opacity: 0, rotate: 30 }}
              transition={{ type: "spring", stiffness: 360, damping: 22 }}
              className="absolute text-amber-500"
            >
              <Sun className="w-3.5 h-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="flex-1 text-left">{isDark ? "Dark" : "Light"} theme</span>
      <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-500">{isDark ? "on" : "off"}</span>
    </button>
  );
}
