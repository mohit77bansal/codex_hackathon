import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { AgentCard } from "./AgentCard";
import { FaultLines } from "./FaultLines";
import type { AgentKey } from "../../lib/types";
import { COLOR_HEX, stanceColor } from "../../lib/format";
import { useCountUp } from "../../hooks/useCountUp";
import { useSwarmStore } from "../../store/swarmStore";

const LEFT: AgentKey[] = ["bureau", "bank", "fraud"];
const RIGHT: AgentKey[] = ["income", "policy", "behaviour"];

export function ConsensusHub({ onFocusAgent }: { onFocusAgent: (k: AgentKey) => void }) {
  const agents = useSwarmStore((s) => s.agents);
  const verdict = useSwarmStore((s) => s.verdict);
  const progress = useSwarmStore((s) => s.progress);
  const debate = useSwarmStore((s) => s.debate);

  const done = (Object.keys(agents) as AgentKey[])
    .filter((k) => k !== "lead" && k !== "governor")
    .every((k) => agents[k].state === "done");
  const consensus = calcConsensus(agents);
  const animatedConsensus = useCountUp(consensus, 700, [consensus]);

  const verdictHex = COLOR_HEX[verdict ? stanceColor(verdict.value) : "slate"];

  return (
    <div className="mx-6 mb-5 rounded-2xl ring-1 ring-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-5 relative overflow-hidden">
      <motion.div
        className="absolute inset-0 opacity-40 pointer-events-none"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "linear-gradient(120deg, rgba(99,102,241,.1), rgba(232,121,249,.1), rgba(56,189,248,.1))",
          backgroundSize: "220% 220%",
        }}
      />

      <div className="relative grid grid-cols-12 gap-3 items-stretch">
        <div className="col-span-3 space-y-2.5">
          {LEFT.map((key) => (
            <AgentCard
              key={key}
              agentKey={key}
              state={agents[key].state}
              position={agents[key].position}
              onHover={onFocusAgent}
            />
          ))}
        </div>

        <div className="col-span-6 relative min-h-[320px]">
          <FlowLines agents={agents} />
          {debate?.pairs && debate.pairs.length > 0 && <FaultLines conflictPairs={debate.pairs} />}
          <div className="absolute inset-0 grid place-items-center">
            <Gauge
              score={animatedConsensus}
              verdict={verdict?.value || "pending"}
              verdictHex={verdictHex}
              done={!!verdict}
            />
          </div>
        </div>

        <div className="col-span-3 space-y-2.5">
          {RIGHT.map((key) => (
            <AgentCard
              key={key}
              agentKey={key}
              state={agents[key].state}
              position={agents[key].position}
              onHover={onFocusAgent}
            />
          ))}
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <Loader2 className={`w-3 h-3 ${done && verdict ? "" : "animate-spin"}`} />
          {verdict
            ? `Decision delivered · ${verdict.chip}`
            : done
              ? "Experts complete · lead and governor closing"
              : `Running experts · progress ${progress}%`}
          {debate?.pairs && debate.pairs.length > 0 && !verdict && (
            <span className="ml-2 text-rose-300 text-[10px] uppercase tracking-widest">
              · {debate.pairs.length} fault line{debate.pairs.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3.5 py-2 rounded-lg bg-rose-500/10 ring-1 ring-rose-400/30 text-rose-200 text-xs font-medium hover:bg-rose-500/20 transition flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
          <button className="px-3.5 py-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-400/30 text-amber-200 text-xs font-medium hover:bg-amber-500/20 transition flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Escalate
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-600 text-white text-xs font-semibold hover:brightness-110 transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/30"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function calcConsensus(agents: ReturnType<typeof useSwarmStore.getState>["agents"]): number {
  const positions = (Object.keys(agents) as AgentKey[])
    .filter((k) => k !== "lead" && k !== "governor")
    .map((k) => agents[k].position)
    .filter(Boolean) as NonNullable<ReturnType<typeof useSwarmStore.getState>["agents"]["bureau"]["position"]>[];
  if (!positions.length) return 0;
  return Math.round(positions.reduce((a, p) => a + p.score, 0) / positions.length);
}

function Gauge({
  score,
  verdict,
  verdictHex,
  done,
}: {
  score: number;
  verdict: string;
  verdictHex: string;
  done: boolean;
}) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = 100;
  const arcLen = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <radialGradient id="gaugeGlow" r=".6">
            <stop offset="0%" stopColor={verdictHex} stopOpacity=".55" />
            <stop offset="100%" stopColor={verdictHex} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r + 22} fill="url(#gaugeGlow)" />
        <motion.circle
          cx={cx}
          cy={cy}
          r={r + 18}
          fill="none"
          stroke="rgba(255,255,255,.1)"
          strokeWidth="1"
          strokeDasharray="2 5"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%" }}
        />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeDasharray={arcLen}
          initial={{ strokeDashoffset: arcLen }}
          animate={{ strokeDashoffset: arcLen * (1 - pct) }}
          transition={{ type: "spring", stiffness: 80, damping: 18 }}
          style={{ filter: "drop-shadow(0 0 8px rgba(129,140,248,.4))" }}
        />
        {Array.from({ length: 60 }).map((_, i) => {
          const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + Math.cos(angle) * (r - 16);
          const y1 = cy + Math.sin(angle) * (r - 16);
          const x2 = cx + Math.cos(angle) * (r - 22);
          const y2 = cy + Math.sin(angle) * (r - 22);
          const highlight = i < Math.round(pct * 60);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={highlight ? verdictHex : "rgba(255,255,255,.18)"}
              strokeWidth={highlight ? 1.4 : 1}
            />
          );
        })}
        <motion.g
          animate={{ rotate: pct * 360 }}
          transition={{ type: "spring", stiffness: 90, damping: 14, mass: 1.2 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        >
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 6} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy - r + 6} r="4" fill={verdictHex} />
        </motion.g>
        <circle cx={cx} cy={cy} r="5" fill="#fff" />
      </svg>
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Consensus</div>
          <motion.div
            key={Math.round(score)}
            className="text-5xl font-bold tabular-nums leading-none mt-1"
            initial={{ scale: 0.96, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{
              background: `linear-gradient(120deg,#fff, ${verdictHex})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: `drop-shadow(0 0 10px ${verdictHex}55)`,
            }}
          >
            {Math.round(score)}
          </motion.div>
          <div className="text-[10px] text-slate-500 mt-0.5">/ 100</div>
          {done && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mt-2 text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1"
              style={{ background: `${verdictHex}22`, color: verdictHex, border: `1px solid ${verdictHex}55` }}
            >
              Verdict: {verdict}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function FlowLines({ agents }: { agents: ReturnType<typeof useSwarmStore.getState>["agents"] }) {
  const leftY = [15, 50, 85];
  const rightY = [15, 50, 85];
  const paths = [
    ...LEFT.map((key, i) => ({ key, d: `M 2 ${leftY[i]} C 30 ${leftY[i]}, 40 50, 50 50` })),
    ...RIGHT.map((key, i) => ({ key, d: `M 98 ${rightY[i]} C 70 ${rightY[i]}, 60 50, 50 50` })),
  ];
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="flowGrad" x1="0" x2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0" />
          <stop offset="60%" stopColor="#818cf8" stopOpacity=".5" />
          <stop offset="100%" stopColor="#e879f9" stopOpacity=".9" />
        </linearGradient>
      </defs>
      {paths.map(({ key, d }) => {
        const active = agents[key].state !== "idle";
        return (
          <g key={key}>
            <path d={d} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth=".4" vectorEffect="non-scaling-stroke" />
            {active && (
              <motion.path
                d={d}
                fill="none"
                stroke="url(#flowGrad)"
                strokeWidth=".7"
                vectorEffect="non-scaling-stroke"
                strokeDasharray="4 3"
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: -120 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                style={{ filter: "drop-shadow(0 0 2px #818cf8)" }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
