import { AnimatePresence, motion } from "framer-motion";
import { Compass, ShieldCheck, Sparkles } from "lucide-react";

import { useSwarmStore } from "../../store/swarmStore";

const METER_LABELS: Record<string, { label: string; color: string }> = {
  uncertainty: { label: "Uncertainty", color: "#fbbf24" },
  conflict: { label: "Conflict", color: "#fb7185" },
  pressure: { label: "Business pressure", color: "#a78bfa" },
  reversibility: { label: "Reversibility", color: "#34d399" },
};

export function LeadPanel() {
  const lead = useSwarmStore((s) => s.lead);
  const debate = useSwarmStore((s) => s.debate);

  if (!lead) {
    return (
      <div className="mx-6 mb-5 rounded-2xl ring-1 ring-white/10 bg-white/[0.02] p-5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-violet-300" /> Lead reviewer will reframe the real tradeoff.
        </div>
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-6 mb-5 rounded-2xl ring-1 ring-white/10 bg-gradient-to-br from-violet-500/10 via-transparent to-sky-500/5 p-5"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center bg-violet-500/20 ring-1 ring-violet-400/40">
          <Compass className="w-5 h-5 text-violet-200" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-widest text-violet-200/80 font-semibold">Lead reframed the tradeoff</div>
          <div className="text-base font-semibold mt-1">{lead.question}</div>
          <div className="text-sm text-slate-300 mt-2">
            <ShieldCheck className="inline w-4 h-4 text-emerald-300 mr-1" /> {lead.structure}
          </div>
          {debate?.topics?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {debate.topics.map((t) => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 ring-1 ring-white/10 text-slate-300">
                  <Sparkles className="inline w-3 h-3 mr-1 text-fuchsia-300" />
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5 mt-4">
        <AnimatePresence>
          {Object.entries(lead.meters || {}).map(([key, value]) => {
            const meta = METER_LABELS[key] || { label: key, color: "#cbd5e1" };
            return (
              <motion.div
                key={key}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 px-3 py-2"
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-400">
                  <span>{meta.label}</span>
                  <span className="tabular-nums text-slate-200">{value}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    style={{ background: `linear-gradient(90deg, ${meta.color}, #fff4)` }}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
