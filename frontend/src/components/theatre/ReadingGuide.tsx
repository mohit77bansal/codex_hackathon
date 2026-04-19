import { motion } from "framer-motion";
import { Eye, MessageSquare, ShieldCheck } from "lucide-react";

const ITEMS: { Icon: typeof Eye; title: string; body: string; tone: string }[] = [
  {
    Icon: Eye,
    title: "1. Read the pressure",
    body: "Conflicting signals, explicit constraints, and uncertainty that cannot be ignored surface up front.",
    tone: "#17344f",
  },
  {
    Icon: MessageSquare,
    title: "2. Watch the debate",
    body: "Specialists do not collapse into one answer — they expose tension, and the lead reframes the real tradeoff.",
    tone: "#c97822",
  },
  {
    Icon: ShieldCheck,
    title: "3. Inspect the call",
    body: "The governor issues a visible, accountable decision with confidence, constraint fit, and audit trace.",
    tone: "#0f766e",
  },
];

export function ReadingGuide() {
  return (
    <div className="mx-6 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
      {ITEMS.map(({ Icon, title, body, tone }, i) => (
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
          className="rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.04] p-4 flex gap-3 items-start"
        >
          <div
            className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
            style={{ background: `${tone}22`, color: tone, border: `1px solid ${tone}44` }}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
              Step
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
            <div className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-400 mt-1">
              {body}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
