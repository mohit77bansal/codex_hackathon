import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, CheckCircle2, CircleDollarSign, PieChart, Scale, XCircle } from "lucide-react";

import { formatInr } from "../lib/format";

interface PortfolioResponse {
  total_cases: number;
  booked_cases: number;
  rejected_cases: number;
  total_exposure_inr: number;
  approved_exposure_inr: number;
  conditional_exposure_inr: number;
  avg_consensus_score: number;
  industry_mix: { label: string; count: number; exposure: number }[];
  geography_mix: { label: string; count: number; exposure: number }[];
  loan_type_mix: { label: string; count: number }[];
  verdict_mix: { label: string; count: number }[];
  top_industries: { label: string; exposure: number }[];
  top_geographies: { label: string; exposure: number }[];
  hhi: { industry: number; geography: number };
}

const VERDICT_HEX: Record<string, string> = {
  approve: "#34d399",
  conditional: "#fbbf24",
  reject: "#fb7185",
  escalate: "#a78bfa",
};

export function PortfolioPage() {
  const { data, isLoading } = useQuery<PortfolioResponse>({
    queryKey: ["portfolio"],
    queryFn: () => fetch("/api/insights/portfolio/").then((r) => r.json()),
    refetchInterval: 10_000,
  });

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="px-6 pt-6 pb-10">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">Portfolio</div>
          <h1 className="text-2xl font-semibold tracking-tight">Exposure & concentration</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Book-level view of approved and conditionally-approved applications. Concentration measured by HHI across industry and geography.
          </p>
        </motion.div>

        {isLoading || !data ? (
          <div className="mt-6 text-xs text-slate-500 dark:text-slate-400">Loading portfolio...</div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 mt-6">
              <Kpi label="Total exposure" value={formatInr(data.total_exposure_inr)} tone="sky" Icon={CircleDollarSign} />
              <Kpi label="Booked applications" value={`${data.booked_cases} / ${data.total_cases}`} tone="emerald" Icon={CheckCircle2} />
              <Kpi label="Rejected" value={data.rejected_cases.toString()} tone="rose" Icon={XCircle} />
              <Kpi label="Avg consensus" value={data.avg_consensus_score ? `${data.avg_consensus_score}` : "–"} tone="indigo" Icon={Activity} />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <Concentration
                title="Industry HHI"
                subtitle="Herfindahl index on industry exposure"
                value={data.hhi.industry}
                items={data.industry_mix.map((m) => ({ label: m.label, count: m.count, exposure: m.exposure }))}
                Icon={PieChart}
              />
              <Concentration
                title="Geography HHI"
                subtitle="Herfindahl index on state-level exposure"
                value={data.hhi.geography}
                items={data.geography_mix.map((m) => ({ label: m.label, count: m.count, exposure: m.exposure }))}
                Icon={Building2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <VerdictMix mix={data.verdict_mix} />
              <TopList title="Top industries" items={data.top_industries} Icon={PieChart} />
              <TopList title="Top geographies" items={data.top_geographies} Icon={Building2} />
            </div>

            <LoanTypeMix items={data.loan_type_mix} />
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, Icon }: { label: string; value: string; tone: string; Icon: any }) {
  const hex = { sky: "#38bdf8", emerald: "#34d399", rose: "#fb7185", indigo: "#818cf8" }[tone] || "#cbd5e1";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-slate-900/[0.025] dark:bg-white/[0.03] p-4 overflow-hidden"
    >
      <span className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl" style={{ background: `${hex}22` }} />
      <div className="relative text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
        <Icon className="w-4 h-4" style={{ color: hex }} />
        {label}
      </div>
      <div
        className="relative mt-2 text-2xl font-semibold tabular-nums"
        style={{ background: `linear-gradient(120deg,#fff 30%, ${hex})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
      >
        {value}
      </div>
    </motion.div>
  );
}

function Concentration({
  title,
  subtitle,
  value,
  items,
  Icon,
}: {
  title: string;
  subtitle: string;
  value: number;
  items: { label: string; count: number; exposure: number }[];
  Icon: any;
}) {
  const total = items.reduce((s, i) => s + i.exposure, 0) || 1;
  const band =
    value < 1500 ? { label: "Low concentration", color: "#34d399" } : value < 2500 ? { label: "Moderate", color: "#fbbf24" } : { label: "High concentration", color: "#fb7185" };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-slate-900/[0.025] dark:bg-white/[0.03] p-5"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-900/[0.05] dark:bg-white/5 ring-1 ring-slate-900/10 dark:ring-white/10 grid place-items-center text-slate-700 dark:text-slate-300">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">HHI</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: band.color }}>
            {value.toFixed(0)}
          </div>
          <div className="text-[10px]" style={{ color: band.color }}>
            {band.label}
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {items.slice(0, 6).map((i) => (
          <div key={i.label}>
            <div className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300">
              <span>{i.label}</span>
              <span className="tabular-nums">{formatInr(i.exposure)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-900/[0.05] dark:bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400"
                initial={{ width: 0 }}
                animate={{ width: `${(i.exposure / total) * 100}%` }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function VerdictMix({ mix }: { mix: { label: string; count: number }[] }) {
  const total = mix.reduce((s, m) => s + m.count, 0) || 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-slate-900/[0.025] dark:bg-white/[0.03] p-5"
    >
      <div className="text-sm font-semibold flex items-center gap-2">
        <Scale className="w-4 h-4 text-violet-300" /> Verdict mix
      </div>
      <div className="mt-3 space-y-2">
        {mix.map((m) => (
          <div key={m.label}>
            <div className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300 capitalize">
              <span>{m.label}</span>
              <span className="tabular-nums">{m.count}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-900/[0.05] dark:bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(m.count / total) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: VERDICT_HEX[m.label] || "#cbd5e1" }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function TopList({ title, items, Icon }: { title: string; items: { label: string; exposure: number }[]; Icon: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-slate-900/[0.025] dark:bg-white/[0.03] p-5"
    >
      <div className="text-sm font-semibold flex items-center gap-2">
        <Icon className="w-4 h-4 text-sky-300" /> {title}
      </div>
      <ul className="mt-3 space-y-2">
        {items.length === 0 && <li className="text-xs text-slate-500">No booked exposure yet.</li>}
        {items.map((i, idx) => (
          <li key={i.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="text-slate-500 tabular-nums">#{idx + 1}</span>
              <span>{i.label}</span>
            </span>
            <span className="tabular-nums text-slate-700 dark:text-slate-300">{formatInr(i.exposure)}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function LoanTypeMix({ items }: { items: { label: string; count: number }[] }) {
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-slate-900/[0.025] dark:bg-white/[0.03] p-5"
    >
      <div className="text-sm font-semibold">Loan type mix</div>
      <div className="mt-3 flex items-center gap-2 h-3 rounded-full overflow-hidden bg-slate-900/[0.05] dark:bg-white/5">
        {items.map((i, idx) => {
          const colors = ["#818cf8", "#34d399", "#fbbf24", "#fb7185", "#38bdf8"];
          return (
            <motion.div
              key={i.label}
              className="h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(i.count / total) * 100}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: idx * 0.08 }}
              style={{ background: colors[idx % colors.length] }}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        {items.map((i, idx) => {
          const colors = ["#818cf8", "#34d399", "#fbbf24", "#fb7185", "#38bdf8"];
          return (
            <span key={i.label} className="flex items-center gap-1.5 capitalize">
              <span className="w-2 h-2 rounded-full" style={{ background: colors[idx % colors.length] }} />
              {i.label.replace("_", " ")} · {i.count}
            </span>
          );
        })}
      </div>
    </motion.div>
  );
}
