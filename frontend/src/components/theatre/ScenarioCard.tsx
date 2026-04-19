import { motion } from "framer-motion";
import { AlertTriangle, Compass } from "lucide-react";

import type { CaseDetail } from "../../lib/types";
import { formatInr } from "../../lib/format";

function deriveHeadline(detail: CaseDetail | undefined): string {
  if (!detail) return "Awaiting case data";
  const name = detail.applicant_name || detail.applicant?.legal_name || "applicant";
  const amt = detail.amount_inr ? ` for ${formatInr(detail.amount_inr)}` : "";
  const sector = detail.sector ? ` in ${detail.sector}` : "";
  return `Evaluate ${name}${sector}${amt} without losing governance`;
}

function deriveSummary(detail: CaseDetail | undefined): string {
  if (!detail) return "Case signals will appear once the backend has parsed the supporting documents.";
  const bureau = detail.bureau?.cibil_score;
  const dscr = detail.financial?.dscr;
  const parts: string[] = [];
  if (bureau) parts.push(`CIBIL ${bureau}`);
  if (typeof dscr === "number" && dscr > 0) parts.push(`DSCR ${dscr.toFixed(2)}`);
  if (detail.vintage_years) parts.push(`vintage ${detail.vintage_years} yrs`);
  const tail = parts.length ? ` Signals so far: ${parts.join(" · ")}.` : "";
  return `The applicant profile has real strengths but also caution zones. The decision cannot be a blind yes or no.${tail}`;
}

function deriveTension(detail: CaseDetail | undefined): string {
  if (!detail) return "Growth wants to move, risk wants discipline. Data is good enough to tempt, not clean enough to skip judgment.";
  const band = detail.risk_band;
  if (band === "high") {
    return "Risk signals are loud and repayment quality is noisy, but the applicant brings scale and sector-relevant pull.";
  }
  if (band === "low") {
    return "The core profile looks clean, but exposure concentration and segment clustering still need visible discipline.";
  }
  return "Business momentum and risk warnings pull in opposite directions. The data supports movement, not autopilot.";
}

function deriveConstraints(detail: CaseDetail | undefined): { title: string; body: string }[] {
  if (!detail) {
    return [
      { title: "Signals in conflict", body: "Waiting for documents to parse." },
      { title: "Hard boundary", body: "Policy will require explicit rationale for any exception." },
      { title: "Uncertainty", body: "Cash-flow and bureau signals are not yet available." },
      { title: "Business pressure", body: "Sales urgency typically high in this segment." },
    ];
  }
  const dscr = detail.financial?.dscr ?? 0;
  const cibil = detail.bureau?.cibil_score ?? 0;
  const utilization = detail.bureau?.utilization_pct ?? 0;
  const concentration = detail.income?.top_3_buyer_concentration_pct ?? 0;

  return [
    {
      title: "Signals in conflict",
      body:
        cibil >= 720
          ? "Bureau looks healthy, but cashflow/utilization indicators deserve scrutiny."
          : "Bureau texture is soft; only a strong business story can justify movement.",
    },
    {
      title: "Hard boundary",
      body: `Policy allows exceptions only with explicit rationale${
        dscr > 0 ? ` and DSCR ${dscr.toFixed(2)} framing` : ""
      }.`,
    },
    {
      title: "Uncertainty",
      body:
        utilization > 0
          ? `Utilization ${utilization.toFixed(0)}% raises a stability question that must be named.`
          : "Cash flow stability is inferred from partial records, not complete clean books.",
    },
    {
      title: "Business pressure",
      body:
        concentration > 40
          ? `Buyer concentration ${concentration.toFixed(0)}% concentrates revenue risk.`
          : "Commercial urgency is real and raises the bar for a disciplined explanation.",
    },
  ];
}

export function ScenarioCard({ detail }: { detail: CaseDetail | undefined }) {
  const headline = deriveHeadline(detail);
  const summary = deriveSummary(detail);
  const tension = deriveTension(detail);
  const constraints = deriveConstraints(detail);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-gradient-to-br from-white/70 via-white/50 to-amber-50/30 dark:from-white/[0.05] dark:to-white/[0.01] p-5"
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
        <Compass className="w-3.5 h-3.5" />
        Scenario
      </div>
      <h3 className="mt-2 font-display text-2xl leading-tight tracking-tight text-slate-900 dark:text-slate-50">
        {headline}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{summary}</p>

      <div className="mt-4 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.05] ring-1 ring-slate-900/10 dark:ring-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-rose-500 dark:text-rose-300">
          <AlertTriangle className="w-3 h-3" />
          Core tension
        </div>
        <div className="mt-1.5 text-[13px] leading-relaxed text-slate-900 dark:text-slate-100">
          {tension}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {constraints.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
            className="rounded-xl bg-white/70 dark:bg-white/[0.04] ring-1 ring-slate-900/10 dark:ring-white/10 p-3"
          >
            <div className="text-[10px] uppercase tracking-widest font-semibold text-amber-700 dark:text-amber-300">
              {c.title}
            </div>
            <div className="mt-1 text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-300">
              {c.body}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
