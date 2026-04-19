import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Flame, ShieldAlert } from "lucide-react";

import { formatInr } from "../lib/format";

interface Escalation {
  case_id: string;
  external_id: string;
  applicant_name: string;
  amount_inr: number;
  reason: string;
  severity: "low" | "medium" | "high";
  created_at: string;
}

const SEV_COLOR: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  high: { bg: "bg-rose-500/10", text: "text-rose-200", border: "ring-rose-400/30", icon: "#fb7185" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-200", border: "ring-amber-400/30", icon: "#fbbf24" },
  low: { bg: "bg-sky-500/10", text: "text-sky-200", border: "ring-sky-400/30", icon: "#38bdf8" },
};

export function EscalationsPage() {
  const nav = useNavigate();
  const { data, isLoading } = useQuery<Escalation[]>({
    queryKey: ["escalations"],
    queryFn: () => fetch("/api/insights/escalations/").then((r) => r.json()),
    refetchInterval: 8_000,
  });

  const items = data || [];
  const high = items.filter((i) => i.severity === "high").length;
  const medium = items.filter((i) => i.severity === "medium").length;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="px-6 pt-6 pb-10">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">Human in the loop</div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Escalations
            {high > 0 && (
              <motion.span
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40"
              >
                <Flame className="w-3 h-3" /> {high} critical
              </motion.span>
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Applications flagged by the expert panel for senior review — failed runs, lead escalations, governor rejects, or manual overrides.
          </p>
        </motion.div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          <Kpi label="Critical" value={high.toString()} tone="rose" Icon={Flame} />
          <Kpi label="Review needed" value={medium.toString()} tone="amber" Icon={AlertTriangle} />
          <Kpi label="Total flagged" value={items.length.toString()} tone="sky" Icon={ShieldAlert} />
        </div>

        {isLoading && <div className="mt-6 text-xs text-slate-500 dark:text-slate-400">Loading escalations...</div>}
        {!isLoading && items.length === 0 && (
          <div className="mt-8 rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-slate-900/[0.025] dark:bg-white/[0.03] p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No escalations. The panel is handling every application within policy.
          </div>
        )}

        <div className="mt-5 space-y-2.5">
          {items.map((i, idx) => {
            const sev = SEV_COLOR[i.severity];
            return (
              <motion.button
                key={i.case_id + idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ x: 4 }}
                onClick={() => nav(`/cases/${i.case_id}`)}
                className={`w-full text-left rounded-xl ring-1 ${sev.border} ${sev.bg} p-4 flex items-center gap-4 transition-colors hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]`}
              >
                <div className="w-10 h-10 rounded-lg ring-1 ring-slate-900/10 dark:ring-white/15 grid place-items-center shrink-0" style={{ color: sev.icon }}>
                  {i.severity === "high" ? <Flame className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-semibold truncate">{i.applicant_name}</div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{i.external_id}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-widest ring-1 ${sev.border} ${sev.text}`}>
                      {i.severity}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">{i.reason}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums">{formatInr(i.amount_inr)}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 justify-end">
                    Review application <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, Icon }: { label: string; value: string; tone: string; Icon: any }) {
  const hex = { rose: "#fb7185", amber: "#fbbf24", sky: "#38bdf8" }[tone] || "#cbd5e1";
  return (
    <div className="relative rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-slate-900/[0.025] dark:bg-white/[0.03] p-4 overflow-hidden">
      <span className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl" style={{ background: `${hex}22` }} />
      <div className="relative text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
        <Icon className="w-4 h-4" style={{ color: hex }} />
        {label}
      </div>
      <div
        className="relative mt-2 text-2xl font-semibold tabular-nums"
        style={{ background: `linear-gradient(120deg,#fff 30%, ${hex})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
      >
        {value}
      </div>
    </div>
  );
}
