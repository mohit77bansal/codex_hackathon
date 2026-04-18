import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Loader2, Radio } from "lucide-react";

import type { AgentKey, Position } from "../../lib/types";
import { AGENT_META } from "../../lib/types";
import { COLOR_HEX, stanceColor } from "../../lib/format";

function useTypewriter(text: string, speed = 14) {
  const [out, setOut] = useState("");
  useEffect(() => {
    setOut("");
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return out;
}

export function ReasoningStream({
  agentKey,
  position,
}: {
  agentKey: AgentKey | null;
  position: Position | undefined;
}) {
  const meta = agentKey ? AGENT_META[agentKey] : null;
  const rationale = position?.rationale || "";
  const typed = useTypewriter(rationale, 12);
  const stanceHex = position ? COLOR_HEX[stanceColor(position.stance)] : COLOR_HEX.slate;

  if (!agentKey || !position) {
    return (
      <div className="mx-6 mb-6 rounded-2xl ring-1 ring-white/10 bg-white/[0.03] p-5 text-xs text-slate-400 flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Experts are warming up — rationale will stream here.
      </div>
    );
  }

  return (
    <motion.div
      key={agentKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mx-6 mb-6 rounded-2xl ring-1 ring-white/10 bg-white/[0.03] p-5 relative overflow-hidden"
    >
      <div className="relative flex items-center gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{meta?.name ?? agentKey}</div>
          <div className="text-[11px] text-slate-400">{meta?.short}</div>
        </div>
        <span className="ml-auto text-[10px] text-slate-400 flex items-center gap-1">
          <Radio className="w-3 h-3" /> Streaming rationale
        </span>
      </div>
      <div className="relative mt-3 rounded-xl bg-slate-950/60 ring-1 ring-white/5 p-4 font-mono text-[12.5px] leading-relaxed text-slate-200 min-h-[84px]">
        <span className="text-slate-500">[{agentKey}@arbiter] › </span>
        {typed}
        <motion.span
          className="inline-block w-[7px] h-[14px] align-middle ml-0.5"
          style={{ background: stanceHex }}
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </div>
      <div className="relative mt-3 flex items-center gap-3 text-[11px] text-slate-400">
        <span>
          Stance <span style={{ color: stanceHex }} className="font-medium uppercase">{position.stance}</span>
        </span>
        <span>
          · Confidence <span className="text-white tabular-nums">{(position.confidence * 100).toFixed(0)}%</span>
        </span>
        <span>· Score <span className="text-white tabular-nums">{position.score}</span></span>
        {position.flags.length > 0 && (
          <span className="ml-auto flex items-center gap-1">
            <AnimatePresence>
              {position.flags.slice(0, 3).map((f, i) => (
                <motion.span
                  key={`${f.code}-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ring-1 ${
                    f.severity === "high"
                      ? "bg-rose-500/15 text-rose-300 ring-rose-400/30"
                      : f.severity === "medium"
                        ? "bg-amber-500/15 text-amber-300 ring-amber-400/30"
                        : "bg-sky-500/15 text-sky-300 ring-sky-400/30"
                  }`}
                >
                  {f.code}
                </motion.span>
              ))}
            </AnimatePresence>
          </span>
        )}
      </div>
    </motion.div>
  );
}
