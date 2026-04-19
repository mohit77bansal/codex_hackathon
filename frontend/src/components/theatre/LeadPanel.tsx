import { motion } from "framer-motion";
import { Compass, ShieldCheck, Sparkles } from "lucide-react";

import { useEffectiveSwarm } from "../../hooks/useEffectiveSwarm";

export function LeadPanel() {
  const { lead, debate } = useEffectiveSwarm();

  if (!lead) {
    return (
      <div className="rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.03] p-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-violet-600 dark:text-violet-300" /> Lead reviewer will reframe the tradeoff.
        </div>
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-gradient-to-br from-violet-500/10 via-white/60 to-sky-500/10 dark:from-violet-500/15 dark:via-transparent dark:to-sky-500/10 p-5"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center bg-violet-500/20 ring-1 ring-violet-400/40 shrink-0">
          <Compass className="w-5 h-5 text-violet-600 dark:text-violet-200" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-violet-700 dark:text-violet-200/80 font-bold">
            Lead reframed the tradeoff
          </div>
          <div className="text-[15px] font-semibold mt-1 text-slate-900 dark:text-slate-50 leading-snug">
            {lead.question}
          </div>
          <div className="text-[13px] text-slate-700 dark:text-slate-300 mt-2 flex items-start gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-300 mt-0.5 shrink-0" />
            <span>{lead.structure}</span>
          </div>
          {debate?.topics?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {debate.topics.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/70 dark:bg-white/[0.06] ring-1 ring-slate-900/10 dark:ring-white/10 text-slate-700 dark:text-slate-300 inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-fuchsia-500 dark:text-fuchsia-300" />
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
