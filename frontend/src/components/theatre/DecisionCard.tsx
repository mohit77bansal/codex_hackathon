import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { CheckCircle2, Flag, Lock, ShieldAlert, Sparkles } from "lucide-react";

import type { AgentKey, CaseDetail } from "../../lib/types";
import { COLOR_HEX, stanceColor } from "../../lib/format";
import { useCountUp } from "../../hooks/useCountUp";
import { useEffectiveSwarm } from "../../hooks/useEffectiveSwarm";

const SPECIALISTS: AgentKey[] = ["bureau", "bank", "fraud", "income", "policy", "behaviour"];

function deriveProgress(
  specialistsDone: number,
  anyThinking: boolean,
  hasDebate: boolean,
  hasLead: boolean,
  hasVerdict: boolean,
): { pct: number; label: string } {
  if (hasVerdict) return { pct: 100, label: "Decision logged" };
  if (hasLead) return { pct: 80, label: "Governor finalizing" };
  if (hasDebate) return { pct: 62, label: "Lead reframing tradeoff" };
  if (specialistsDone >= SPECIALISTS.length)
    return { pct: 52, label: "Reconciling specialist positions" };
  if (anyThinking || specialistsDone > 0)
    return {
      pct: Math.max(18, Math.round(20 + (specialistsDone / SPECIALISTS.length) * 30)),
      label: "Scanning evidence",
    };
  return { pct: 6, label: "Idle" };
}

export function DecisionCard({ caseDetail }: { caseDetail: CaseDetail | undefined }) {
  const { agents, debate, lead, verdict, isReplaying } = useEffectiveSwarm();
  // While replaying, the final_decision snapshot hasn't been "revealed" yet —
  // suppress it until the governor bubble fires so the card doesn't jump ahead.
  const decision = isReplaying && !verdict ? undefined : caseDetail?.final_decision;

  const specialistsDone = SPECIALISTS.filter((k) => agents[k]?.state === "done").length;
  const anyThinking = SPECIALISTS.some((k) => agents[k]?.state === "thinking");

  const { pct: progressPct, label: progressLabel } = useMemo(
    () =>
      deriveProgress(
        specialistsDone,
        anyThinking,
        !!debate?.pairs?.length,
        !!lead,
        !!verdict || !!decision,
      ),
    [specialistsDone, anyThinking, debate, lead, verdict, decision],
  );
  const animatedProgress = useCountUp(progressPct, 700, [progressPct]);

  const stance = verdict?.value || decision?.verdict || "conditional";
  const confidence = verdict?.confidence ?? decision?.confidence ?? 0;
  const rationale = verdict?.rationale || decision?.rationale || "";
  const chip = verdict?.chip || decision?.chip_label || "";
  const hex = COLOR_HEX[stanceColor(stance)];
  const conditions = decision?.conditions || [];
  const checkpoints = decision?.review_checkpoints || [];
  const constraintFit = decision?.constraint_fit || "—";
  const auditStrength = decision?.audit_strength || "—";
  const animatedConfidence = useCountUp(confidence * 100, 1400, [confidence]);

  if (!verdict && !decision) {
    return (
      <motion.section
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.03] p-5"
      >
        <ProgressBlock pct={animatedProgress} label={progressLabel} />
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Lock className="w-4 h-4" /> Awaiting governor's accountable call.
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      layout
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="relative rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-gradient-to-br from-white/80 to-white/40 dark:from-white/[0.06] dark:to-white/[0.01] p-5 overflow-hidden"
      style={{ boxShadow: `0 20px 60px ${hex}22` }}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        style={{ background: `radial-gradient(circle at 50% 0%, ${hex}18, transparent 60%)` }}
      />
      <motion.div
        className="absolute left-0 right-0 top-0 h-[2px] pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${hex}, transparent)` }}
        initial={{ x: "-100%", opacity: 0 }}
        animate={{ x: "100%", opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      />

      <ProgressBlock pct={animatedProgress} label={progressLabel} accent={hex} />

      <div className="relative mt-4 flex items-start gap-3">
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
          <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Final Governor
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={stance}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mt-1 text-3xl font-bold uppercase tracking-tight"
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
      </div>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.6 }}
        className="relative mt-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
      >
        {rationale}
      </motion.p>

      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <ScoreTile label="Confidence" value={`${Math.round(animatedConfidence)}%`} accent={hex} />
        <ScoreTile label="Constraint fit" value={constraintFit} accent="#0f766e" />
        <ScoreTile label="Audit strength" value={auditStrength} accent="#c97822" />
      </div>

      {conditions.length > 0 && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.45 } } }}
          className="relative mt-4"
        >
          <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-300" /> Conditions
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {conditions.map((c) => (
              <motion.li
                key={c}
                variants={{
                  hidden: { opacity: 0, x: -8 },
                  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
                }}
                className="text-xs rounded-lg bg-white/70 dark:bg-white/[0.04] ring-1 ring-slate-900/10 dark:ring-white/10 px-3 py-2 text-slate-800 dark:text-slate-200"
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
          <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
            <Flag className="w-3 h-3 text-sky-500 dark:text-sky-300" /> Review checkpoints
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {checkpoints.map((c) => (
              <li
                key={c}
                className="text-[11px] px-2 py-1 rounded-full bg-white/70 dark:bg-white/[0.04] ring-1 ring-slate-900/10 dark:ring-white/10 text-slate-800 dark:text-slate-200"
              >
                {c}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {decision?.override_by_user && (
        <div className="relative mt-4 rounded-xl bg-rose-500/10 ring-1 ring-rose-400/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Overridden by {decision.override_by_user}: {decision.override_note}
        </div>
      )}
    </motion.section>
  );
}

function ProgressBlock({
  pct,
  label,
  accent = "#17344f",
}: {
  pct: number;
  label: string;
  accent?: string;
}) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 dark:text-slate-400">
          Decision progress
        </span>
        <span className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">{label}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-slate-900/10 dark:bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: `linear-gradient(90deg,#c97822,#0f766e,${accent})` }}
        />
      </div>
    </div>
  );
}

function ScoreTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.04] p-3"
      style={{ boxShadow: `inset 0 0 0 1px ${accent}11` }}
    >
      <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}
