import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, FileText, Play, ShieldAlert } from "lucide-react";

import { api } from "../api/client";
import type { AgentKey } from "../lib/types";
import { AuditStream } from "../components/theatre/AuditStream";
import { DocumentUploader } from "../components/intake/DocumentUploader";
import { ConsensusHub } from "../components/theatre/ConsensusHub";
import { DecisionCard } from "../components/theatre/DecisionCard";
import { LeadPanel } from "../components/theatre/LeadPanel";
import { ReasoningStream } from "../components/theatre/ReasoningStream";
import { useSwarmStore } from "../store/swarmStore";
import { useSwarmStream } from "../hooks/useSwarmStream";
import { formatInr } from "../lib/format";

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
  const agents = useSwarmStore((s) => s.agents);
  useSwarmStream(id);

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
      <div className="px-6 pt-5 pb-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => nav("/queue")} className="p-2 rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <motion.div
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center shrink-0"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Building2 className="w-6 h-6" />
          </motion.div>
          <div className="min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-semibold truncate"
              style={{
                background: "linear-gradient(120deg,#fff,#c7d2fe)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {detail?.applicant_name || "Loading..."}
            </motion.div>
            {detail && (
              <div className="text-xs text-slate-400 mt-0.5">
                {detail.external_id} · {detail.sector} · {detail.state} · vintage {detail.vintage_years} yrs · {formatInr(detail.amount_inr)}
              </div>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {detail?.final_decision && (
            <button
              onClick={() => {
                const v = prompt("Override verdict to (approve/reject/conditional/escalate)?", "conditional");
                if (v) overrideMut.mutate(v);
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 ring-1 ring-rose-400/30 text-rose-200 text-xs flex items-center gap-1.5"
            >
              <ShieldAlert className="w-3 h-3" /> Override verdict
            </button>
          )}
          <button
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-xs flex items-center gap-1.5 font-semibold disabled:opacity-60"
          >
            <Play className="w-3 h-3" /> {runMut.isPending ? "Convening panel…" : detail?.final_decision ? "Re-run panel" : "Run expert panel"}
          </button>
        </div>
      </div>

      <motion.div
        layout
        animate={{
          filter: runMut.isPending ? "brightness(0.7) saturate(0.8)" : "brightness(1) saturate(1)",
        }}
        transition={{ duration: 0.6 }}
        className="px-6 py-5 grid grid-cols-4 gap-3"
      >
        <StatBlock label="Requested" value={detail ? formatInr(detail.amount_inr) : "--"} tone="indigo" />
        <StatBlock
          label="CIBIL"
          value={detail?.bureau?.cibil_score?.toString() || "--"}
          sub={detail?.bureau ? (detail.bureau.cibil_score >= 750 ? "Prime" : detail.bureau.cibil_score >= 700 ? "Near-prime" : "Sub-prime") : ""}
          tone={detail?.bureau?.cibil_score && detail.bureau.cibil_score >= 750 ? "emerald" : "amber"}
        />
        <StatBlock label="DSCR" value={detail?.financial?.dscr?.toFixed(2) || "--"} tone="sky" />
        <StatBlock label="Policy version" value={detail?.applicant ? "v1" : "v1"} tone="fuchsia" />
      </motion.div>

      <ConsensusHub onFocusAgent={(k) => setFocusAgent(k)} />
      <LeadPanel />
      <ReasoningStream agentKey={focus} position={focusPosition} />
      <DecisionCard caseDetail={detail} />

      {auditQuery.data && (
        <AuditStream entries={auditQuery.data.entries} chainValid={auditQuery.data.chain_valid} />
      )}

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
    indigo: "from-indigo-400/10 to-transparent",
    emerald: "from-emerald-400/10 to-transparent",
    amber: "from-amber-400/10 to-transparent",
    sky: "from-sky-400/10 to-transparent",
    fuchsia: "from-fuchsia-400/10 to-transparent",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl ring-1 ring-white/10 bg-gradient-to-b ${colors[tone] || colors.indigo} p-3`}
    >
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </motion.div>
  );
}
