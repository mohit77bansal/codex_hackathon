import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Brain, Cpu, Database, FileText, ShieldCheck, Trash2, Zap } from "lucide-react";

import { api } from "../api/client";

interface SettingsResponse {
  llm: {
    synthetic_mode: boolean;
    has_api_key: boolean;
    specialist_model: string;
    orchestrator_model: string;
  };
  celery: { eager_mode: boolean; broker: string };
  policy: { path: string; content: string };
  database: { engine: string };
  health: { total_cases: number; agent_runs: number; failed_runs: number; audit_chain_breaks: number };
}

export function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/insights/settings/").then((r) => r.json()),
    refetchInterval: 15_000,
  });
  const purge = useMutation({
    mutationFn: () => api.purgeAllCases(),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="px-6 pt-6 pb-10 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-[11px] uppercase tracking-widest text-slate-400">Runtime</div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings & health</h1>
          <p className="text-sm text-slate-400 mt-1">
            Live view of how the swarm is configured and whether the audit chain is intact.
          </p>
        </motion.div>

        {isLoading || !data ? (
          <div className="mt-6 text-xs text-slate-400">Loading runtime state...</div>
        ) : (
          <>
            <SectionHeading title="LLM configuration" icon={Brain} />
            <div className="grid grid-cols-2 gap-3">
              <Row
                label="Mode"
                value={data.llm.synthetic_mode ? "Synthetic (deterministic fallback)" : "Live (OpenAI)"}
                tone={data.llm.synthetic_mode ? "amber" : "emerald"}
                help={
                  data.llm.synthetic_mode
                    ? "Running offline. Provide OPENAI_API_KEY and set SWARM_SYNTHETIC_MODE=False to go live."
                    : "All agents are calling OpenAI and validating structured output."
                }
              />
              <Row
                label="API key"
                value={data.llm.has_api_key ? "Present" : "Not set"}
                tone={data.llm.has_api_key ? "emerald" : "rose"}
              />
              <Row label="Specialist model" value={data.llm.specialist_model} tone="indigo" mono />
              <Row label="Orchestrator model" value={data.llm.orchestrator_model} tone="fuchsia" mono />
            </div>

            <SectionHeading title="Orchestration" icon={Cpu} />
            <div className="grid grid-cols-2 gap-3">
              <Row
                label="Execution mode"
                value={data.celery.eager_mode ? "Inline (eager)" : "Celery worker"}
                tone={data.celery.eager_mode ? "amber" : "emerald"}
              />
              <Row label="Broker" value={data.celery.broker} tone="sky" mono />
              <Row label="Database engine" value={data.database.engine.split(".").pop() || ""} tone="indigo" mono />
            </div>

            <SectionHeading title="Health" icon={Activity} />
            <div className="grid grid-cols-4 gap-3">
              <HealthCard label="Total applications" value={data.health.total_cases} tone="indigo" Icon={FileText} />
              <HealthCard label="Agent runs" value={data.health.agent_runs} tone="sky" Icon={Zap} />
              <HealthCard label="Failed runs" value={data.health.failed_runs} tone={data.health.failed_runs ? "rose" : "emerald"} Icon={Activity} />
              <HealthCard
                label="Audit chain"
                value={data.health.audit_chain_breaks === 0 ? "Intact" : `${data.health.audit_chain_breaks} broken`}
                tone={data.health.audit_chain_breaks === 0 ? "emerald" : "rose"}
                Icon={ShieldCheck}
              />
            </div>

            <SectionHeading title="Danger zone" icon={Trash2} />
            <div className="rounded-xl ring-1 ring-rose-400/30 bg-rose-500/10 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-rose-100">Purge all applications and audit entries</div>
                <div className="text-[11px] text-rose-200/80 mt-0.5">
                  Removes every application, agent run, decision, and ledger entry. Documents on disk will be orphaned — clear them manually if needed.
                </div>
              </div>
              <button
                type="button"
                disabled={purge.isPending}
                onClick={() => {
                  if (window.confirm("Delete ALL applications and audit data? This cannot be undone.")) purge.mutate();
                }}
                className="px-3 py-2 rounded-lg bg-rose-500/20 ring-1 ring-rose-400/40 text-rose-100 text-xs font-semibold hover:bg-rose-500/30 disabled:opacity-50"
              >
                {purge.isPending ? "Purging…" : "Purge data"}
              </button>
            </div>
            {purge.isSuccess && <div className="mt-2 text-[11px] text-emerald-300">Purged. Queue is empty.</div>}

            <SectionHeading title="Active credit policy" icon={Database} />
            <div className="rounded-xl ring-1 ring-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400 truncate">{data.policy.path}</div>
                <div className="text-[10px] text-slate-500">read-only</div>
              </div>
              <pre className="text-[12px] leading-relaxed font-mono text-slate-200 whitespace-pre-wrap">
                {data.policy.content || "(policy file not readable)"}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ title, icon: Icon }: { title: string; icon: any }) {
  return (
    <div className="mt-8 mb-3 flex items-baseline gap-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
    </div>
  );
}

function Row({
  label,
  value,
  tone = "slate",
  help,
  mono,
}: {
  label: string;
  value: string;
  tone?: string;
  help?: string;
  mono?: boolean;
}) {
  const hex =
    { emerald: "#34d399", amber: "#fbbf24", rose: "#fb7185", indigo: "#818cf8", sky: "#38bdf8", fuchsia: "#e879f9", slate: "#cbd5e1" }[tone] ||
    "#cbd5e1";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-4"
    >
      <div className="text-[11px] uppercase tracking-widest text-slate-400">{label}</div>
      <div
        className={`mt-1 text-base font-semibold ${mono ? "font-mono text-sm" : ""}`}
        style={{ color: hex }}
      >
        {value}
      </div>
      {help && <div className="mt-2 text-[11px] text-slate-400 leading-relaxed">{help}</div>}
    </motion.div>
  );
}

function HealthCard({ label, value, tone, Icon }: { label: string; value: string | number; tone: string; Icon: any }) {
  const hex = { emerald: "#34d399", rose: "#fb7185", indigo: "#818cf8", sky: "#38bdf8" }[tone] || "#cbd5e1";
  return (
    <div className="relative rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-4 overflow-hidden">
      <span className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl" style={{ background: `${hex}22` }} />
      <div className="relative text-[11px] text-slate-400 flex items-center gap-1.5">
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
