import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Layers, Play, ShieldAlert, Users, Volume2, VolumeX } from "lucide-react";

import { api } from "../api/client";
import type { AgentKey } from "../lib/types";
import { AuditStream } from "../components/theatre/AuditStream";
import { DocumentUploader } from "../components/intake/DocumentUploader";
import { AgentCard } from "../components/theatre/AgentCard";
import { AgentChatRail } from "../components/theatre/AgentChatRail";
import { DecisionCard } from "../components/theatre/DecisionCard";
import { DecisionFlowTimeline } from "../components/theatre/DecisionFlowTimeline";
import { LeadPanel } from "../components/theatre/LeadPanel";
import { MeterGrid } from "../components/theatre/MeterGrid";
import { ReadingGuide } from "../components/theatre/ReadingGuide";
import { ReasoningStream } from "../components/theatre/ReasoningStream";
import { ScenarioCard } from "../components/theatre/ScenarioCard";
import { useSwarmStore } from "../store/swarmStore";
import { useSwarmStream } from "../hooks/useSwarmStream";
import { useSwarmSounds } from "../hooks/useSwarmSounds";
import { useEffectiveSwarm } from "../hooks/useEffectiveSwarm";
import { formatInr } from "../lib/format";
import { isMuted, toggleMuted, unlockAudio } from "../lib/sound";

const SPECIALISTS: AgentKey[] = ["bureau", "bank", "fraud", "income", "policy", "behaviour"];

export function CaseTheatrePage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [focusAgent, setFocusAgent] = useState<AgentKey | null>(null);

  const detailQuery = useQuery({
    queryKey: ["case", id],
    queryFn: () => api.getCase(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && ["intake", "running", "debating"].includes(s) ? 2000 : false;
    },
  });

  const auditQuery = useQuery({
    queryKey: ["audit", id],
    queryFn: () => api.getAudit(id!),
    enabled: !!id,
    refetchInterval: 3000,
  });

  const reset = useSwarmStore((s) => s.reset);
  const setCase = useSwarmStore((s) => s.setCase);
  const beginReplay = useSwarmStore((s) => s.beginReplay);
  const tickReplay = useSwarmStore((s) => s.tickReplay);
  const chatLogLen = useSwarmStore((s) => s.chatLog.length);
  const displayedCount = useSwarmStore((s) => s.displayedCount);
  const replayMode = useSwarmStore((s) => s.replayMode);
  useSwarmStream(id);
  useSwarmSounds();

  const { agents, lead } = useEffectiveSwarm();

  useEffect(() => {
    if (!replayMode) return;
    if (displayedCount >= chatLogLen) return;
    // First message drops in ~450ms after Run; subsequent messages ~700ms apart.
    const delay = displayedCount === 0 ? 450 : 700;
    const t = setTimeout(() => tickReplay(), delay);
    return () => clearTimeout(t);
  }, [replayMode, displayedCount, chatLogLen, tickReplay]);

  const [muted, setMutedState] = useState<boolean>(isMuted());
  const onToggleMute = () => setMutedState(toggleMuted());

  useEffect(() => {
    if (id) reset(id);
  }, [id, reset]);

  useEffect(() => {
    if (detailQuery.data) setCase(detailQuery.data);
  }, [detailQuery.data, setCase]);

  const runMut = useMutation({
    mutationFn: () => api.runCase(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case", id] });
      qc.invalidateQueries({ queryKey: ["audit", id] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });

  const overrideMut = useMutation({
    mutationFn: (verdict: string) =>
      api.overrideCase(id!, verdict, `Manual override to ${verdict}`, "mohit@progcap"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case", id] });
      qc.invalidateQueries({ queryKey: ["audit", id] });
    },
  });

  const detail = detailQuery.data;
  const focus = useMemo(() => {
    if (!focusAgent) {
      const last = detail?.positions?.[detail.positions.length - 1]?.agent_key as AgentKey | undefined;
      return last || ("bureau" as AgentKey);
    }
    return focusAgent;
  }, [focusAgent, detail?.positions]);

  const focusPosition = agents[focus]?.position;

  if (!id) return null;

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-6 pt-5 pb-3 flex items-center gap-3 border-b border-slate-900/[0.05] dark:border-white/5">
        <button
          onClick={() => nav("/queue")}
          className="p-2 rounded-lg bg-slate-900/[0.05] dark:bg-white/5 ring-1 ring-slate-900/10 dark:ring-white/10 hover:bg-slate-900/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <motion.div
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center shrink-0 text-white"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Building2 className="w-6 h-6" />
          </motion.div>
          <div className="min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-semibold truncate text-slate-900 dark:text-white"
            >
              {detail?.applicant_name || "Loading..."}
            </motion.div>
            {detail && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {detail.external_id} · {detail.sector || "sector TBD"} · {detail.state || "location TBD"} · vintage {detail.vintage_years} yrs · {formatInr(detail.amount_inr)}
              </div>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onToggleMute}
            title={muted ? "Enable sound" : "Mute sound"}
            className="p-2 rounded-lg bg-slate-900/[0.05] dark:bg-white/5 ring-1 ring-slate-900/10 dark:ring-white/10 hover:bg-slate-900/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {detail?.final_decision && (
            <button
              onClick={() => {
                const v = prompt("Override verdict to (approve/reject/conditional/escalate)?", "conditional");
                if (v) overrideMut.mutate(v);
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 ring-1 ring-rose-400/40 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-1.5 hover:bg-rose-500/20"
            >
              <ShieldAlert className="w-3 h-3" /> Override verdict
            </button>
          )}
          <button
            onClick={() => {
              unlockAudio();
              beginReplay();
              runMut.mutate();
            }}
            disabled={runMut.isPending}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-xs flex items-center gap-1.5 font-semibold disabled:opacity-60 shadow-sm shadow-indigo-500/20"
          >
            <Play className="w-3 h-3" /> {runMut.isPending ? "Convening panel…" : detail?.final_decision ? "Re-run panel" : "Run expert panel"}
          </button>
        </div>
      </div>

      <motion.div
        layout
        animate={{
          filter: runMut.isPending ? "brightness(0.92) saturate(0.9)" : "brightness(1) saturate(1)",
        }}
        transition={{ duration: 0.6 }}
        className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <StatBlock label="Requested" value={detail ? formatInr(detail.amount_inr) : "--"} tone="indigo" />
        <StatBlock
          label="CIBIL"
          value={detail?.bureau?.cibil_score?.toString() || "--"}
          sub={detail?.bureau ? (detail.bureau.cibil_score >= 750 ? "Prime" : detail.bureau.cibil_score >= 700 ? "Near-prime" : "Sub-prime") : ""}
          tone={detail?.bureau?.cibil_score && detail.bureau.cibil_score >= 750 ? "emerald" : "amber"}
        />
        <StatBlock label="DSCR" value={detail?.financial?.dscr?.toFixed(2) || "--"} tone="sky" />
        <StatBlock label="Policy version" value="v1" tone="fuchsia" />
      </motion.div>

      <ReadingGuide />

      <div className="mx-6 mb-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <ScenarioCard detail={detail} />

          <section className="rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <div className="text-[11px] uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
                  Pressure readout
                </div>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {lead ? "Lead meters" : "Synthesized pre-run"}
              </div>
            </div>
            <MeterGrid detail={detail} liveMeters={lead?.meters} />
          </section>

          <section className="rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <div className="text-[11px] uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
                  Specialist agents
                </div>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Six lenses · one spine</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {SPECIALISTS.map((key) => (
                <AgentCard
                  key={key}
                  agentKey={key}
                  state={agents[key].state}
                  position={agents[key].position}
                  onHover={(k) => setFocusAgent(k)}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4 min-w-0">
          <section className="rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
                Decision flow
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Conflict stays visible
              </div>
            </div>
            <DecisionFlowTimeline />
          </section>

          <AgentChatRail />

          <LeadPanel />

          <DecisionCard caseDetail={detail} />

          {auditQuery.data && (
            <AuditStream entries={auditQuery.data.entries} chainValid={auditQuery.data.chain_valid} />
          )}
        </div>
      </div>

      <div className="mx-6 mb-6">
        <ReasoningStream agentKey={focus} position={focusPosition} />
      </div>

      <div className="px-6 pb-10">
        <DocumentUploader
          caseId={id || null}
          documents={detail?.documents || []}
          onChange={() => qc.invalidateQueries({ queryKey: ["case", id] })}
        />
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  sub,
  tone = "indigo",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-400/15 to-transparent",
    emerald: "from-emerald-400/15 to-transparent",
    amber: "from-amber-400/15 to-transparent",
    sky: "from-sky-400/15 to-transparent",
    fuchsia: "from-fuchsia-400/15 to-transparent",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-gradient-to-b ${colors[tone] || colors.indigo} bg-white/60 dark:bg-white/[0.03] p-3`}
    >
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-1 text-slate-900 dark:text-slate-100">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>
      )}
    </motion.div>
  );
}
