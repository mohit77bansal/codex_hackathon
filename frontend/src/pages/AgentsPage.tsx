import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, CheckCircle2, Compass, FileText, Scale, Shield, ShieldAlert, Wallet } from "lucide-react";

import { COLOR_HEX } from "../lib/format";

interface AgentStat {
  key: string;
  name: string;
  short: string;
  role: string;
  model_tier: string;
  color: string;
  run_count: number;
  completed: number;
  failed: number;
  avg_latency_ms: number;
  avg_score: number;
  avg_confidence: number;
  stance_mix: { approve: number; reject: number; conditional: number; review: number };
}

const ICONS: Record<string, any> = {
  bureau: BarChart3,
  bank: Wallet,
  fraud: Shield,
  income: FileText,
  policy: Scale,
  behaviour: Activity,
  lead: Compass,
  governor: CheckCircle2,
};

export function AgentsPage() {
  const { data, isLoading } = useQuery<AgentStat[]>({
    queryKey: ["agents"],
    queryFn: () => fetch("/api/agents/").then((r) => r.json()),
    refetchInterval: 8_000,
  });

  const agents = data || [];
  const specialists = agents.filter((a) => a.model_tier === "specialist");
  const orchestrators = agents.filter((a) => a.model_tier === "orchestrator");

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="px-6 pt-6 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-end justify-between"
        >
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400">Roster</div>
            <h1 className="text-2xl font-semibold tracking-tight">Experts</h1>
            <p className="text-sm text-slate-400 mt-1">
              Six experts + one Lead + one Governor. Same spine, different souls depending on the domain.
            </p>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-3">
            <span>
              Total runs <b className="text-slate-100 tabular-nums">{agents.reduce((s, a) => s + a.run_count, 0)}</b>
            </span>
            <span>
              Failures <b className="text-rose-300 tabular-nums">{agents.reduce((s, a) => s + a.failed, 0)}</b>
            </span>
          </div>
        </motion.div>

        {isLoading && <div className="mt-6 text-xs text-slate-400">Loading roster...</div>}

        {!isLoading && (
          <>
            <SectionHeading title="Experts" subtitle="Parallel evidence evaluators" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {specialists.map((a, i) => (
                <AgentTile key={a.key} agent={a} delay={i * 0.05} />
              ))}
            </div>

            <SectionHeading title="Orchestrators" subtitle="Reconciliation and final authority" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {orchestrators.map((a, i) => (
                <AgentTile key={a.key} agent={a} delay={i * 0.05} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mt-8 mb-3 flex items-baseline justify-between">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-slate-400">{subtitle}</div>
      </div>
      <div className="h-px flex-1 mx-4 bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
    </div>
  );
}

function AgentTile({ agent, delay }: { agent: AgentStat; delay: number }) {
  const hex = COLOR_HEX[agent.color] || COLOR_HEX.slate;
  const Icon = ICONS[agent.key] || Activity;
  const total =
    agent.stance_mix.approve + agent.stance_mix.reject + agent.stance_mix.conditional + agent.stance_mix.review;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl ring-1 ring-white/10 bg-white/[0.03] p-5 overflow-hidden"
    >
      <motion.span
        className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl pointer-events-none"
        style={{ background: `${hex}22` }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl grid place-items-center ring-1"
          style={{ background: `${hex}22`, borderColor: `${hex}50`, color: hex }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{agent.name}</div>
          <div className="text-[11px] text-slate-400 truncate">{agent.short}</div>
        </div>
        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 ring-1 ring-white/10 text-slate-300">
          {agent.model_tier}
        </span>
      </div>

      <p className="relative mt-3 text-xs text-slate-300 leading-relaxed">{agent.role}</p>

      <div className="relative grid grid-cols-3 gap-2 mt-4 text-center">
        <Stat label="Runs" value={agent.run_count.toString()} />
        <Stat label="Avg score" value={agent.avg_score ? agent.avg_score.toFixed(1) : "–"} />
        <Stat label="Avg confidence" value={agent.avg_confidence ? `${(agent.avg_confidence * 100).toFixed(0)}%` : "–"} />
      </div>

      {total > 0 && (
        <div className="relative mt-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5">Stance mix</div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
            {agent.stance_mix.approve > 0 && (
              <motion.div
                className="h-full bg-emerald-400/80"
                initial={{ width: 0 }}
                animate={{ width: `${(agent.stance_mix.approve / total) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            {agent.stance_mix.conditional > 0 && (
              <motion.div
                className="h-full bg-amber-400/80"
                initial={{ width: 0 }}
                animate={{ width: `${(agent.stance_mix.conditional / total) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              />
            )}
            {agent.stance_mix.review > 0 && (
              <motion.div
                className="h-full bg-sky-400/80"
                initial={{ width: 0 }}
                animate={{ width: `${(agent.stance_mix.review / total) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              />
            )}
            {agent.stance_mix.reject > 0 && (
              <motion.div
                className="h-full bg-rose-400/80"
                initial={{ width: 0 }}
                animate={{ width: `${(agent.stance_mix.reject / total) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              />
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
            <Legend dot="bg-emerald-400" label={`Approve ${agent.stance_mix.approve}`} />
            <Legend dot="bg-amber-400" label={`Conditional ${agent.stance_mix.conditional}`} />
            <Legend dot="bg-sky-400" label={`Review ${agent.stance_mix.review}`} />
            <Legend dot="bg-rose-400" label={`Reject ${agent.stance_mix.reject}`} />
          </div>
        </div>
      )}

      <div className="relative mt-4 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          Avg latency <span className="text-slate-200 tabular-nums">{agent.avg_latency_ms} ms</span>
        </span>
        {agent.failed > 0 ? (
          <span className="text-rose-300 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> {agent.failed} failed
          </span>
        ) : (
          <span className="text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> clean
          </span>
        )}
      </div>
    </motion.article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/10 py-2">
      <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-slate-100 mt-0.5">{value}</div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
