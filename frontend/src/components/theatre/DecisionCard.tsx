import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Flag, Lock, ShieldAlert, Sparkles } from "lucide-react";

import type { CaseDetail } from "../../lib/types";
import { COLOR_HEX, stanceColor } from "../../lib/format";
import { useCountUp } from "../../hooks/useCountUp";
import { useSwarmStore } from "../../store/swarmStore";

export function DecisionCard({ caseDetail }: { caseDetail: CaseDetail | undefined }) {
  const verdict = useSwarmStore((s) => s.verdict);
  const decision = caseDetail?.final_decision;

  if (!verdict && !decision) {
    return (
      <div className="mx-6 mb-6 rounded-2xl ring-1 ring-white/10 bg-white/[0.02] p-5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400" /> Awaiting governor's accountable call.
        </div>
      </div>
    );
  }

  const stance = verdict?.value || decision?.verdict || "conditional";
  const confidence = verdict?.confidence ?? decision?.confidence ?? 0;
  const rationale = verdict?.rationale || decision?.rationale || "";
  const chip = verdict?.chip || decision?.chip_label || "";
  const hex = COLOR_HEX[stanceColor(stance)];
  const conditions = decision?.conditions || [];
  const checkpoints = decision?.review_checkpoints || [];
  const animatedConfidence = useCountUp(confidence * 100, 1400, [confidence]);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="mx-6 mb-6 relative rounded-2xl ring-1 ring-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.01] p-6 overflow-hidden"
      style={{ boxShadow: `0 20px 60px ${hex}22` }}
    >
      {/* The "held breath" radial bloom */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        style={{ background: `radial-gradient(circle at 50% 0%, ${hex}18, transparent 60%)` }}
      />

      {/* Horizontal sweep reveal — the verdict being struck */}
      <motion.div
        className="absolute left-0 right-0 top-0 h-[2px] pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${hex}, transparent)` }}
        initial={{ x: "-100%", opacity: 0 }}
        animate={{ x: "100%", opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      />

      <motion.div
        className="absolute -right-16 -top-16 w-60 h-60 rounded-full blur-3xl pointer-events-none"
        style={{ background: `${hex}30` }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex items-start gap-3">
        <motion.div
          className="w-12 h-12 rounded-xl grid place-items-center"
          style={{ background: `${hex}22`, border: `1px solid ${hex}50` }}
          initial={{ scale: 0.8, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.15 }}
        >
          <CheckCircle2 className="w-6 h-6" style={{ color: hex }} />
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-slate-400">Final Governor</div>
          <AnimatePresence mode="wait">
            <motion.div
              key={stance}
              initial={{ y: 12, opacity: 0, letterSpacing: "-0.01em" }}
              animate={{ y: 0, opacity: 1, letterSpacing: "-0.02em" }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mt-1 text-3xl font-bold uppercase"
              style={{ color: hex }}
            >
              {stance}
            </motion.div>
          </AnimatePresence>
          {chip && (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-2 inline-block text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full"
              style={{ background: `${hex}22`, color: hex, border: `1px solid ${hex}55` }}
            >
              {chip}
            </motion.span>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-slate-400">Confidence</div>
          <motion.div className="relative text-3xl font-bold tabular-nums">
            {Math.round(animatedConfidence)}%
            {/* lock micro-animation once it settles */}
            <motion.div
              className="absolute -right-2 -top-2 w-2 h-2 rounded-full"
              style={{ background: hex }}
              initial={{ scale: 0 }}
              animate={{ scale: animatedConfidence > confidence * 100 - 0.5 ? 1 : 0 }}
              transition={{ duration: 0.3, delay: 1.4 }}
            />
          </motion.div>
        </div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.6 }}
        className="relative mt-4 text-sm text-slate-300 leading-relaxed"
      >
        {rationale}
      </motion.p>

      {conditions.length > 0 && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.45 } } }}
          className="relative mt-4"
        >
          <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-300" /> Conditions
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {conditions.map((c) => (
              <motion.li
                key={c}
                variants={{
                  hidden: { opacity: 0, x: -8 },
                  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
                }}
                className="text-xs rounded-lg bg-white/[0.03] ring-1 ring-white/10 px-3 py-2 text-slate-200"
              >
                {c}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}

      {checkpoints.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="relative mt-4"
        >
          <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
            <Flag className="w-3 h-3 text-sky-300" /> Review checkpoints
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {checkpoints.map((c) => (
              <li key={c} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10 text-slate-200">
                {c}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {decision?.override_by_user && (
        <div className="relative mt-4 rounded-xl bg-rose-500/10 ring-1 ring-rose-400/30 px-3 py-2 text-xs text-rose-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Overridden by {decision.override_by_user}: {decision.override_note}
        </div>
      )}
    </motion.section>
  );
}
