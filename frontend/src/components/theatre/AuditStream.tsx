import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, ShieldAlert } from "lucide-react";

import type { AuditEntry } from "../../lib/types";

export function AuditStream({ entries, chainValid }: { entries: AuditEntry[]; chainValid: boolean }) {
  return (
    <div className="mx-6 mb-6 rounded-2xl ring-1 ring-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold">Audit ledger</div>
          <div className="text-xs text-slate-400">Append-only, hash-chained</div>
        </div>
        <span
          className={`text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
            chainValid
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
              : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30"
          }`}
        >
          {chainValid ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
          {chainValid ? "Chain verified" : "Chain broken"}
        </span>
      </div>

      <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-lg bg-white/[0.02] ring-1 ring-white/5 p-3"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-400">
                <span className="tabular-nums text-amber-300">#{e.sequence}</span>
                <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
                <span className="ml-auto text-slate-500">{e.actor}</span>
              </div>
              <div className="mt-1 text-sm font-medium">{e.title}</div>
              {e.body && <div className="text-xs text-slate-400 mt-0.5">{e.body}</div>}
              <div className="mt-1 font-mono text-[9px] text-slate-600 truncate">
                prev {e.prev_hash.slice(0, 10) || "·"} → row {e.row_hash.slice(0, 10)}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
