import { motion } from "framer-motion";
import { ArrowUpRight, Brain, CheckCircle2, CircleDollarSign, Clock, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { TopBar } from "../components/common/TopBar";
import { api } from "../api/client";
import { formatInr } from "../lib/format";
import { useState } from "react";

const KPI_COLORS: Record<string, string> = {
  emerald: "#34d399",
  amber: "#fbbf24",
  indigo: "#818cf8",
  fuchsia: "#e879f9",
  sky: "#38bdf8",
};

export function OverviewPage() {
  const [query, setQuery] = useState("");
  const { data: cases } = useQuery({ queryKey: ["cases"], queryFn: () => api.listCases() });
  const list = cases || [];

  const decided = list.filter((c) => c.status === "decided" || c.verdict);
  const approved = decided.filter((c) => c.verdict === "approve").length;
  const conditional = decided.filter((c) => c.verdict === "conditional").length;
  const rejected = decided.filter((c) => c.verdict === "reject").length;
  const totalDisbursed = decided
    .filter((c) => c.verdict === "approve" || c.verdict === "conditional")
    .reduce((s, c) => s + c.amount_inr, 0);

  const kpis = [
    { label: "Approved applications", value: approved, Icon: CheckCircle2, color: "emerald", delta: `${approved}/${list.length}` },
    { label: "Conditional", value: conditional, Icon: Clock, color: "amber", delta: "governed" },
    { label: "Rejected", value: rejected, Icon: Zap, color: "indigo", delta: "hard boundary" },
    { label: "Auto decisions", value: list.length ? Math.round(((approved + conditional + rejected) / list.length) * 100) : 0, Icon: Brain, color: "fuchsia", delta: "% of queue", suffix: "%" },
    { label: "Disbursed value", value: totalDisbursed, Icon: CircleDollarSign, color: "sky", delta: "₹", money: true },
  ];

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <TopBar query={query} setQuery={setQuery} />
      <div className="px-6 pb-4 grid grid-cols-5 gap-3">
        {kpis.map((k, i) => {
          const hex = KPI_COLORS[k.color];
          const display = k.money ? formatInr(k.value as number) : `${k.value}${k.suffix || ""}`;
          return (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-4 overflow-hidden"
            >
              <motion.span
                className="absolute -right-8 -top-8 w-28 h-28 rounded-full blur-2xl"
                style={{ background: `${hex}22` }}
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative text-[11px] text-slate-400 flex items-center gap-1.5">
                <k.Icon className="w-4 h-4" style={{ color: hex }} />
                {k.label}
              </div>
              <div
                className="relative mt-2 text-2xl font-semibold tabular-nums"
                style={{
                  background: `linear-gradient(120deg,#fff 30%, ${hex})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {display}
              </div>
              <div className="relative text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> {k.delta}
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="px-6 pb-10 text-sm text-slate-300 max-w-3xl">
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-semibold tracking-tight"
        >
          Six expert minds, one accountable call.
        </motion.h2>
        <p className="text-slate-400 mt-2 leading-relaxed">
          Each application fans out to six experts — Bureau, Bank, Fraud, Income, Policy, Behavioural — who disagree openly.
          The Lead Reviewer reframes the tradeoff, and the Final Governor issues a confidence-backed verdict with a full
          audit trail. Click into any application to watch the panel reason in real time.
        </p>
      </div>
    </div>
  );
}
