import { motion } from "framer-motion";

import type { CaseDetail } from "../../lib/types";

type MeterTone = "amber" | "crimson" | "plum" | "teal";

interface MeterSpec {
  key: string;
  label: string;
  value: number;
  tone: MeterTone;
  detail: string;
}

const TONE_HEX: Record<MeterTone, string> = {
  amber: "#c97822",
  crimson: "#b44432",
  plum: "#5e466f",
  teal: "#0f766e",
};

export function buildSyntheticMeters(detail: CaseDetail | undefined): MeterSpec[] {
  const dscr = detail?.financial?.dscr ?? 0;
  const cibil = detail?.bureau?.cibil_score ?? 0;
  const utilization = detail?.bureau?.utilization_pct ?? 0;
  const bounces = detail?.financial?.bounces_last_6mo ?? 0;
  const conc = detail?.income?.top_3_buyer_concentration_pct ?? 0;

  const uncertainty = clamp(
    50 +
      (cibil ? 0 : 20) +
      (dscr ? 0 : 15) +
      (utilization > 60 ? 10 : 0) -
      (detail?.documents?.length ? 8 : 0),
  );
  const conflict = clamp(
    40 +
      (cibil >= 720 && bounces > 2 ? 30 : 0) +
      (dscr > 1.2 && utilization > 70 ? 20 : 0) +
      (conc > 50 ? 15 : 0),
  );
  const pressure = clamp(
    55 +
      (detail?.risk_band === "high" ? 15 : detail?.risk_band === "low" ? -5 : 5) +
      (detail?.amount_inr && detail.amount_inr > 1e7 ? 10 : 0),
  );
  const reversibility = clamp(
    55 - (detail?.amount_inr && detail.amount_inr > 1e7 ? 15 : 0) + (dscr > 1.5 ? 10 : 0),
  );

  return [
    {
      key: "uncertainty",
      label: "Uncertainty",
      value: uncertainty,
      tone: "amber",
      detail: "Cash-flow and bureau confidence is partial — system will flag gaps, not hide them.",
    },
    {
      key: "conflict",
      label: "Conflict",
      value: conflict,
      tone: "crimson",
      detail: "Business momentum and risk warnings are pulling the decision in opposite directions.",
    },
    {
      key: "pressure",
      label: "Business pressure",
      value: pressure,
      tone: "plum",
      detail: "Commercial urgency is high, which raises the need for disciplined explanation.",
    },
    {
      key: "reversibility",
      label: "Reversibility",
      value: reversibility,
      tone: "teal",
      detail: "A poor call is expensive to unwind, so guardrails matter.",
    },
  ];
}

function clamp(v: number): number {
  return Math.max(10, Math.min(96, Math.round(v)));
}

export function MeterGrid({
  detail,
  liveMeters,
}: {
  detail: CaseDetail | undefined;
  liveMeters?: Record<string, number> | null;
}) {
  const synth = buildSyntheticMeters(detail);
  const meters = synth.map((m) => {
    const live = liveMeters?.[m.key];
    return typeof live === "number" && !Number.isNaN(live) ? { ...m, value: Math.round(live) } : m;
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {meters.map((m, i) => {
        const tone = TONE_HEX[m.tone];
        return (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl bg-white/70 dark:bg-white/[0.04] ring-1 ring-slate-900/10 dark:ring-white/10 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
                {m.label}
              </div>
              <div className="text-[12px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {m.value}%
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-900/10 dark:bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${m.value}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: `linear-gradient(90deg, ${tone}, ${tone}aa)` }}
              />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-snug text-slate-600 dark:text-slate-400">
              {m.detail}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
