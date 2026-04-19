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
  const hasPosition = !!position;
  const done = hasPosition;

  const stance = position?.stance;
  const stanceTone = stance ? stanceColor(stance) : "slate";
  const stanceHex = COLOR_HEX[stanceTone] || COLOR_HEX.slate;
  const colorHex = COLOR_HEX[meta.color] || COLOR_HEX.slate;

  const score = useCountUp(position?.score ?? 0, 850, [position?.score, done]);
  const confidencePct = (position?.confidence ?? 0) * 100;
  const animatedConfidence = useCountUp(confidencePct, 850, [position?.confidence, done]);

  // Uncertainty texture: while thinking, score breathes within a band
  const uncertaintyBreath = thinking ? 1 - 0.15 : 0;

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 280, damping: 22, mass: 0.9 }}
      onMouseEnter={() => onHover?.(agentKey)}
      layout
      className="relative rounded-xl ring-1 ring-white/10 bg-white/[0.04] p-3 overflow-hidden transition-colors hover:ring-white/25"
    >
      {/* Material-summon ring that expands outward on first thinking state */}
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
        animate={{ scale: thinking ? [1, 1.18, 1] : [1, 1.06, 1], opacity: thinking ? [0.6, 1, 0.6] : [0.5, 0.7, 0.5] }}
        transition={{ duration: thinking ? 1.4 : 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex items-center gap-2">
        <motion.div
          className="w-9 h-9 rounded-lg grid place-items-center ring-1"
          style={{ background: `${colorHex}22`, borderColor: `${colorHex}40`, color: colorHex }}
          animate={thinking ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={thinking ? { duration: 1.2, repeat: Infinity } : { type: "spring", stiffness: 260 }}
        >
          <Icon className="w-4 h-4" />
        </motion.div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate">{meta.name}</div>
          <div className="text-[10px] text-slate-400 truncate">{meta.short}</div>
        </div>
        {done && (
          <motion.span
            initial={{ opacity: 0, y: -4, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full ring-1 uppercase font-semibold tracking-wider"
            style={{ background: `${stanceHex}22`, color: stanceHex, borderColor: `${stanceHex}55` }}
          >
            {stance}
          </motion.span>
        )}
      </div>

      <div className="relative mt-2.5">
        {thinking && !hasPosition && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <motion.span animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.6, repeat: Infinity }}>
              Pulling evidence
            </motion.span>
          </div>
        )}
        {state === "idle" && !hasPosition && <div className="text-[11px] text-slate-500">Awaiting signal</div>}
        {done && position && (
          <>
            <div className="flex items-baseline gap-1">
              <motion.div
                className="text-xl font-semibold tabular-nums"
                animate={{
                  filter: `blur(${uncertaintyBreath}px)`,
                  textShadow: thinking ? `0 0 12px ${colorHex}55` : "none",
                }}
                style={{
                  background: `linear-gradient(120deg,#fff, ${colorHex})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {Math.round(score)}
              </motion.div>
              <div className="text-[10px] text-slate-400 tabular-nums">
                conf {Math.round(animatedConfidence)}%
              </div>
            </div>
            <div className="mt-1.5 relative h-1.5 rounded-full bg-white/5 overflow-hidden">
              {/* fuzzy-edge confidence bar — snaps sharp when done */}
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${colorHex}, ${stanceHex})`,
                  filter: `blur(${uncertaintyBreath * 2}px)`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${position.score}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.div
                className="absolute inset-y-0 right-0 w-6 pointer-events-none"
                style={{
                  background: `linear-gradient(90deg, transparent, ${stanceHex}66)`,
                }}
                initial={{ opacity: 1 }}
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </>
        )}
      </div>
    </motion.article>
  );
}
