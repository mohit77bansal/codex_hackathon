import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Compass,
  FileText,
  Flame,
  Gavel,
  MessageCircle,
  Scale,
  Shield,
  Wallet,
} from "lucide-react";

import type { AgentKey } from "../../lib/types";
import { AGENT_META } from "../../lib/types";
import { COLOR_HEX, stanceColor } from "../../lib/format";
import type { ChatMessage } from "../../store/swarmStore";
import { useSwarmStore } from "../../store/swarmStore";

const AGENT_ICON: Record<AgentKey, any> = {
  bureau: BarChart3,
  bank: Wallet,
  fraud: Shield,
  income: FileText,
  policy: Scale,
  behaviour: Activity,
  lead: Compass,
  governor: Gavel,
};

function avatarFor(msg: ChatMessage): { Icon: any; hex: string; name: string } {
  if (msg.agent === "debate") {
    return { Icon: Flame, hex: "#b44432", name: "Debate" };
  }
  if (msg.agent === "lead") {
    return { Icon: Compass, hex: "#a78bfa", name: "Lead Reviewer" };
  }
  if (msg.agent === "governor") {
    return { Icon: Gavel, hex: "#17344f", name: "Final Governor" };
  }
  const meta = AGENT_META[msg.agent as AgentKey];
  const Icon = AGENT_ICON[msg.agent as AgentKey] || MessageCircle;
  return {
    Icon,
    hex: COLOR_HEX[meta?.color || "slate"] || COLOR_HEX.slate,
    name: meta?.name || msg.agent,
  };
}

function useTypewriter(text: string, speed = 18): string {
  const [out, setOut] = useState("");
  useEffect(() => {
    setOut("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(text.length, i + 3);
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return out;
}

function Bubble({ msg, animate }: { msg: ChatMessage; animate: boolean }) {
  const { Icon, hex, name } = avatarFor(msg);
  const typed = useTypewriter(animate ? msg.text : msg.text, animate ? 14 : 0);
  const display = animate ? typed : msg.text;
  const stanceHex = msg.stance ? COLOR_HEX[stanceColor(msg.stance)] : undefined;
  const isSystem = msg.agent === "debate" || msg.agent === "governor" || msg.agent === "lead";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.9 }}
      className="grid grid-cols-[32px_1fr] gap-2.5 items-start"
    >
      <motion.div
        initial={{ scale: 0.6, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 20 }}
        className="w-8 h-8 rounded-lg grid place-items-center shrink-0 ring-1"
        style={{ background: `${hex}22`, borderColor: `${hex}55`, color: hex }}
      >
        <Icon className="w-3.5 h-3.5" />
      </motion.div>
      <div
        className={`min-w-0 rounded-2xl rounded-tl-sm px-3 py-2 ring-1 ${
          isSystem
            ? "bg-gradient-to-br from-white/80 to-white/40 dark:from-white/[0.06] dark:to-white/[0.01] ring-slate-900/10 dark:ring-white/10"
            : "bg-white/80 dark:bg-white/[0.04] ring-slate-900/10 dark:ring-white/10"
        }`}
        style={isSystem ? { boxShadow: `inset 0 0 0 1px ${hex}22` } : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[11px] font-bold tracking-tight truncate"
            style={{ color: hex }}
          >
            {name}
          </span>
          {msg.stance && stanceHex && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full ring-1 uppercase font-bold tracking-[0.12em]"
              style={{
                background: `${stanceHex}1a`,
                color: stanceHex,
                borderColor: `${stanceHex}55`,
              }}
            >
              {msg.stance}
            </span>
          )}
          <span className="ml-auto text-[9px] tabular-nums text-slate-500 dark:text-slate-400">
            {new Date(msg.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
          {display}
          {animate && display.length < msg.text.length && (
            <motion.span
              className="inline-block w-[6px] h-[12px] align-middle ml-0.5"
              style={{ background: hex }}
              animate={{ opacity: [1, 0.1, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          )}
        </p>
      </div>
    </motion.li>
  );
}

export function AgentChatRail() {
  const chatLog = useSwarmStore((s) => s.chatLog);
  const displayedCount = useSwarmStore((s) => s.displayedCount);
  const lastChatId = useSwarmStore((s) => s.lastChatId);
  const replayMode = useSwarmStore((s) => s.replayMode);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const visible = chatLog.slice(0, displayedCount);
  const newestId = visible.length ? visible[visible.length - 1].id : null;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visible.length, newestId]);

  return (
    <section className="rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <div className="text-[11px] uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
            Agent conversation
          </div>
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
          {replayMode
            ? `${visible.length} / ${chatLog.length}`
            : `${visible.length} messages`}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
          The swarm has not convened yet — click <span className="font-semibold">Run expert panel</span> to start the conversation.
        </div>
      ) : (
        <div ref={scrollRef} className="max-h-[420px] overflow-y-auto pr-1">
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {visible.map((m) => (
                <Bubble key={m.id} msg={m} animate={m.id === lastChatId} />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </section>
  );
}
