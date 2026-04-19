import { motion } from "framer-motion";
import { Clock, Filter, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { TopBar } from "../components/common/TopBar";
import { api } from "../api/client";
import { formatInr } from "../lib/format";

const STAGE_PILL: Record<string, string> = {
  intake: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  running: "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30",
  debating: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  decided: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  overridden: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  failed: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
};

const RISK_PILL: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  high: "bg-rose-500/15 text-rose-300",
};

export function CaseQueuePage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: cases, isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: () => api.listCases(),
    refetchInterval: 8_000,
  });

  const seed = useMutation({
    mutationFn: () => api.seedCases(8),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cases"] }),
  });

  const filters = ["All", "intake", "running", "decided", "overridden"];
  const filtered = (cases || []).filter((c) => {
    const passStage = filter === "All" || c.status === filter;
    const passQuery =
      query === "" ||
      c.applicant_name.toLowerCase().includes(query.toLowerCase()) ||
      c.external_id.toLowerCase().includes(query.toLowerCase());
    return passStage && passQuery;
  });

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <TopBar query={query} setQuery={setQuery} />

      <div className="px-6 pt-3 pb-4 flex items-center gap-2">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {cases?.length ?? 0} applications · {filtered.length} matching
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => seed.mutate()}
            disabled={seed.isPending}
            className="px-3 py-1.5 rounded-lg bg-slate-900/[0.05] dark:bg-white/5 ring-1 ring-slate-900/10 dark:ring-white/10 hover:bg-slate-900/10 dark:hover:bg-white/10 text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-3 h-3" /> Seed 8 synthetic applications
          </button>
          <button
            onClick={() => nav("/intake")}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-xs flex items-center gap-1.5 font-semibold"
          >
            <Plus className="w-3 h-3" /> New application
          </button>
        </div>
      </div>

      <div className="px-6 flex gap-1.5 overflow-x-auto no-scrollbar">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs capitalize whitespace-nowrap ring-1 transition-all ${
              filter === f
                ? "bg-white text-slate-900 ring-white"
                : "bg-slate-900/[0.05] dark:bg-white/5 ring-slate-900/10 dark:ring-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-900/10 dark:hover:bg-white/10"
            }`}
          >
            {f}
          </button>
        ))}
        <button className="ml-auto text-xs text-slate-500 dark:text-slate-400 hover:text-white flex items-center gap-1">
          <Filter className="w-3 h-3" /> Advanced
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && <div className="text-xs text-slate-500 dark:text-slate-400">Loading applications...</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="text-xs text-slate-500 dark:text-slate-400 py-10 text-center">
            No applications yet. Click "Seed 8 synthetic applications" or "New application" to start.
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
              whileHover={{ y: -2 }}
              onClick={() => nav(`/cases/${c.id}`)}
              className="text-left rounded-xl p-4 ring-1 ring-slate-900/10 dark:ring-white/10 bg-slate-900/[0.025] dark:bg-white/[0.03] hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] hover:ring-slate-900/15 dark:hover:ring-white/20 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{c.applicant_name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {c.external_id} · {c.loan_type.replace("_", " ")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums">{formatInr(c.amount_inr)}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">{c.sector}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 capitalize ${STAGE_PILL[c.status]}`}>
                  {c.status}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${RISK_PILL[c.risk_band]}`}>
                  {c.risk_band} risk
                </span>
                {c.verdict && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30 uppercase">
                    {c.verdict}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {c.consensus_score ? `${c.consensus_score}/100` : "–"}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
