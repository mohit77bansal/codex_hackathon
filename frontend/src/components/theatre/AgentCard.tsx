import { motion } from "framer-motion";
import { Activity, BarChart3, FileText, Loader2, Scale, Shield, Wallet } from "lucide-react";

import type { AgentKey, Position } from "../../lib/types";
import { AGENT_META } from "../../lib/types";
import { COLOR_HEX, stanceColor } from "../../lib/format";
import { useCountUp } from "../../hooks/useCountUp";
import type { AgentState } from "../../store/swarmStore";

const ICONS: Record<AgentKey, any> = {
  bureau: BarChart3,
  bank: Wallet,
  fraud: Shield,
  income: FileText,
  policy: Scale,
  behaviour: Activity,
  lead: Scale,
  governor: Scale,
};

function pillLabel(state: AgentState): { text: string; tone: string } {
  switch (state) {
    case "thinking":
      return { text: "Analyzing", tone: "#c97822" };
    case "done":
      return { text: "Logged", tone: "#0f766e" };
    case "failed":
      return { text: "Skipped", tone: "#b44432" };
    default:
      return { text: "Ready", tone: "#64748b" };
  }
}

function progressFor(state: AgentState): number {
  switch (state) {
    case "thinking":
      return 62;
    case "done":
      return 100;
    default:
      return 0;
  }
}

export function AgentCard({
  agentKey,
  state,
  position,
  onHover,
}: {
  agentKey: AgentKey;
  state: AgentState;
  position?: Position;
  onHover?: (key: AgentKey) => void;
}) {
  const meta = AGENT_META[agentKey];
  const Icon = ICONS[agentKey] || Activity;
  const thinking = state === "thinking";
  const done = state === "done" && !!position;

  const stance = position?.stance;
  const stanceTone = stance ? stanceColor(stance) : "slate";
  const stanceHex = COLOR_HEX[stanceTone] || COLOR_HEX.slate;
  const colorHex = COLOR_HEX[meta.color] || COLOR_HEX.slate;

  const pill = pillLabel(state);
  const targetProgress = progressFor(state);
  const animatedProgress = useCountUp(targetProgress, 700, [state]);

  const score = useCountUp(position?.score ?? 0, 850, [position?.score, done]);
  const confidencePct = (position?.confidence ?? 0) * 100;
  const animatedConfidence = useCountUp(confidencePct, 850, [position?.confidence, done]);

  // Subtle while thinking; interpolates back to 0 on "done". Clamped to >= 0 so
  // spring overshoot never produces negative blur (which CSS rejects).
  const uncertaintyBreath = thinking ? 0.6 : 0;

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.92, filter: "blur(3px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 280, damping: 22, mass: 0.9 }}
      onMouseEnter={() => onHover?.(agentKey)}
      layout
      className="relative rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.04] p-3 overflow-hidden transition-colors hover:ring-slate-900/20 dark:hover:ring-white/25"
    >
      {(thinking || done) && (
        <motion.span
          key={`ring-${state}`}
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0.4, scale: 0.6 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ border: `1px solid ${colorHex}` }}
        />
      )}

      <motion.span
        className="absolute -right-4 -top-4 w-20 h-20 rounded-full blur-xl pointer-events-none"
        style={{ background: `${colorHex}22` }}
        animate={{
          scale: thinking ? [1, 1.18, 1] : [1, 1.06, 1],
          opacity: thinking ? [0.5, 0.9, 0.5] : [0.3, 0.5, 0.3],
        }}
        transition={{ duration: thinking ? 1.4 : 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex items-center gap-2">
        <motion.div
          className="w-9 h-9 rounded-lg grid place-items-center ring-1 shrink-0"
          style={{ background: `${colorHex}22`, borderColor: `${colorHex}40`, color: colorHex }}
          animate={thinking ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={thinking ? { duration: 1.2, repeat: Infinity } : { type: "spring", stiffness: 260 }}
        >
          <Icon className="w-4 h-4" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold truncate text-slate-900 dark:text-slate-100">
            {meta.name}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{meta.short}</div>
        </div>
        <motion.span
          key={pill.text}
          initial={{ opacity: 0, y: -3, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="text-[9px] px-2 py-0.5 rounded-full ring-1 uppercase font-black tracking-[0.12em] whitespace-nowrap"
          style={{
            color: pill.tone,
            background: `${pill.tone}1a`,
            borderColor: `${pill.tone}55`,
          }}
        >
          {pill.text}
        </motion.span>
      </div>

      <div className="relative mt-2.5 min-h-[44px]">
        {thinking && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <motion.span animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.6, repeat: Infinity }}>
              Pulling evidence
            </motion.span>
          </div>
        )}
        {state === "idle" && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Waiting for signal</div>
        )}
        {done && position && (
          <>
            <div className="flex items-baseline gap-1.5">
              <motion.div
                className="text-xl font-bold tabular-nums"
                animate={{
                  filter: thinking ? `blur(${uncertaintyBreath}px)` : "blur(0px)",
                  textShadow: thinking ? `0 0 12px ${colorHex}55` : "0 0 0px transparent",
                }}
                transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                style={{
                  background: `linear-gradient(120deg, ${colorHex}, ${stanceHex})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {Math.round(score)}
              </motion.div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                conf {Math.round(animatedConfidence)}%
              </div>
              {stance && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full ring-1 uppercase font-bold tracking-[0.12em]"
                  style={{
                    background: `${stanceHex}1a`,
                    color: stanceHex,
                    borderColor: `${stanceHex}55`,
                  }}
                >
                  {stance}
                </motion.span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-2 relative h-1.5 rounded-full bg-slate-900/10 dark:bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: done
              ? `linear-gradient(90deg, ${colorHex}, ${stanceHex})`
              : `linear-gradient(90deg, ${colorHex}, ${colorHex}aa)`,
          }}
          animate={{
            width: `${animatedProgress}%`,
            filter: thinking ? "blur(1.2px)" : "blur(0px)",
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        {thinking && (
          <motion.div
            className="absolute inset-y-0 w-[30%] rounded-full pointer-events-none"
            style={{
              background: `linear-gradient(90deg, transparent, ${colorHex}55, transparent)`,
            }}
            initial={{ x: "-40%" }}
            animate={{ x: "130%" }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>
    </motion.article>
  );
}
