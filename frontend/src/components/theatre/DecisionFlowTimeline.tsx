import { motion } from "framer-motion";
import { useMemo } from "react";

import type { AgentKey } from "../../lib/types";
import { useEffectiveSwarm } from "../../hooks/useEffectiveSwarm";

const STEPS = [
  {
    n: "1",
    title: "Specialists fan out",
    body: "Six experts inspect the case through finance, business, fraud, income, policy, and behaviour lenses.",
  },
  {
    n: "2",
    title: "Conflict is surfaced",
    body: "Positions that disagree light up as fault lines instead of being averaged away.",
  },
  {
    n: "3",
    title: "Lead reframes the tradeoff",
    body: "Instead of a binary yes or no, the lead proposes a conditional structure with guardrails.",
  },
  {
    n: "4",
    title: "Governor makes the call",
    body: "The final decider approves, rejects, or conditionally approves with full audit rationale.",
  },
];

const SPECIALISTS: AgentKey[] = ["bureau", "bank", "fraud", "income", "policy", "behaviour"];

export function DecisionFlowTimeline() {
  const { agents, debate, lead, verdict } = useEffectiveSwarm();

  const { activeIndex, maxCompleted } = useMemo(() => {
    const doneCount = SPECIALISTS.filter((k) => agents[k]?.state === "done").length;
    const anyThinking = SPECIALISTS.some((k) => agents[k]?.state === "thinking");
    let active = -1;
    let completed = -1;
    if (verdict) {
      active = 3;
      completed = 3;
    } else if (lead) {
      active = 2;
      completed = 2;
    } else if (debate?.pairs?.length || (doneCount >= SPECIALISTS.length && !anyThinking)) {
      active = 1;
      completed = 1;
    } else if (anyThinking || doneCount > 0) {
      active = 0;
      completed = doneCount >= SPECIALISTS.length ? 0 : -1;
    }
    return { activeIndex: active, maxCompleted: completed };
  }, [agents, debate, lead, verdict]);

  return (
    <div className="relative grid gap-2">
      <span
        aria-hidden
        className="absolute left-[17px] top-2 bottom-2 w-[2px] rounded bg-gradient-to-b from-sky-500/40 via-indigo-500/40 to-rose-500/40 dark:from-sky-400/30 dark:via-indigo-400/30 dark:to-rose-400/30"
      />
      {STEPS.map((step, idx) => {
        const isLive = idx === activeIndex;
        const isDone = idx <= maxCompleted;
        const state: "pending" | "live" | "done" = isDone
          ? "done"
          : isLive
          ? "live"
          : "pending";

        return (
          <motion.div
            key={step.n}
            initial={{ opacity: 0.35, x: 0 }}
            animate={{
              opacity: state === "pending" ? 0.55 : 1,
              x: state === "live" ? 3 : 0,
            }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative grid grid-cols-[36px_1fr] gap-3 items-start"
          >
            <motion.div
              initial={false}
              animate={{
                scale: state === "live" ? [1, 1.08, 1] : 1,
              }}
              transition={{
                duration: state === "live" ? 1.6 : 0.3,
                repeat: state === "live" ? Infinity : 0,
                ease: "easeInOut",
              }}
              className="relative z-10 w-9 h-9 rounded-xl grid place-items-center text-[12px] font-black text-white shadow"
              style={{
                background:
                  state === "done"
                    ? "linear-gradient(135deg,#17344f,#0f766e)"
                    : state === "live"
                    ? "linear-gradient(135deg,#c97822,#d69b55)"
                    : "linear-gradient(135deg,#64748b,#94a3b8)",
              }}
            >
              {step.n}
            </motion.div>

            <div
              className={`rounded-xl px-3.5 py-2.5 ring-1 ${
                state === "live"
                  ? "ring-amber-400/60 bg-amber-50/70 dark:bg-amber-500/10"
                  : state === "done"
                  ? "ring-slate-900/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.04]"
                  : "ring-slate-900/5 dark:ring-white/5 bg-slate-900/[0.03] dark:bg-white/[0.02]"
              }`}
            >
              <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                {step.title}
              </div>
              <div className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-400 mt-0.5">
                {step.body}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
