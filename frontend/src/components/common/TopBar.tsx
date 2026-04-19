import { motion } from "framer-motion";
import { Bell, Search } from "lucide-react";

export function TopBar({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3 px-6 pt-5 pb-3">
      <div>
        <div className="text-lg font-semibold tracking-tight">Credit Underwriting</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <motion.span
            className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400"
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          Live expert panel · multi-agent reasoning chamber
        </div>
      </div>
      <div className="ml-6 flex-1 max-w-xl relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search applicant, application ID, sector..."
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900/[0.05] dark:bg-white/5 ring-1 ring-slate-900/10 dark:ring-white/10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-indigo-400/50"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button className="p-2 rounded-lg bg-slate-900/[0.05] dark:bg-white/5 hover:bg-slate-900/10 dark:hover:bg-white/10 ring-1 ring-slate-900/10 dark:ring-white/10 relative">
          <Bell className="w-4 h-4 text-slate-700 dark:text-slate-300" />
        </button>
        <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg bg-slate-900/[0.05] dark:bg-white/5 ring-1 ring-slate-900/10 dark:ring-white/10">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 grid place-items-center text-[11px] font-bold">
            MB
          </div>
          <div className="text-xs leading-tight">
            <div className="font-medium">Mohit B.</div>
            <div className="text-slate-500 dark:text-slate-400 text-[10px]">Sr. Underwriter · L3</div>
          </div>
        </div>
      </div>
    </div>
  );
}
