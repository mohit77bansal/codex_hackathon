import { create } from "zustand";

import type { AgentKey, CaseDetail, Position } from "../lib/types";

export type AgentState = "idle" | "thinking" | "done" | "failed";

export interface ChatMessage {
  id: string;
  agent: AgentKey | "debate" | "lead" | "governor";
  title: string;
  text: string;
  stance?: string;
  at: number;
}

interface SwarmState {
  caseId: string | null;
  agents: Record<AgentKey, { state: AgentState; position?: Position }>;
  timeline: { id: string; title: string; body: string; at: string }[];
  debate: { pairs: [string, string, number, string][]; topics: string[] } | null;
  lead: { question: string; structure: string; meters: Record<string, number> } | null;
  verdict: { value: string; chip: string; confidence: number; rationale: string } | null;
  progress: number;
  chatLog: ChatMessage[];
  lastChatId: string | null;
  /** Number of chatLog messages currently revealed to the UI. */
  displayedCount: number;
  /** When true, the UI is replaying chatLog with a stagger; when false, reveals follow chatLog length directly. */
  replayMode: boolean;
  setCase: (c: CaseDetail) => void;
  reset: (caseId: string) => void;
  handleEvent: (evt: Record<string, unknown>) => void;
  beginReplay: () => void;
  tickReplay: () => void;
  skipReplay: () => void;
}

const EMPTY_AGENT: Record<AgentKey, { state: AgentState; position?: Position }> = {
  bureau: { state: "idle" },
  bank: { state: "idle" },
  fraud: { state: "idle" },
  income: { state: "idle" },
  policy: { state: "idle" },
  behaviour: { state: "idle" },
  lead: { state: "idle" },
  governor: { state: "idle" },
};

let msgSeq = 0;
function mid(prefix: string): string {
  msgSeq += 1;
  return `${prefix}-${Date.now()}-${msgSeq}`;
}

function specialistMessage(p: Position): ChatMessage {
  return {
    id: mid(`spec-${p.agent_key}`),
    agent: p.agent_key,
    title: p.display_name,
    stance: p.stance,
    text: p.rationale || `Position: ${p.stance} · score ${p.score}`,
    at: Date.now(),
  };
}

function debateMessage(pairs: [string, string, number, string][], topics: string[]): ChatMessage {
  const lead = pairs
    .slice(0, 3)
    .map(([a, b]) => `${a} ↔ ${b}`)
    .join(", ");
  return {
    id: mid("debate"),
    agent: "debate",
    title: "Fault lines surfaced",
    text:
      pairs.length > 0
        ? `Conflict pairs: ${lead}${pairs.length > 3 ? ` (+${pairs.length - 3} more)` : ""}${topics.length ? ` · topics: ${topics.join(", ")}` : ""}`
        : "No major disagreement detected — still logging for audit.",
    at: Date.now(),
  };
}

function leadMessage(q: string, structure: string): ChatMessage {
  return {
    id: mid("lead"),
    agent: "lead",
    title: "Lead Reviewer",
    text: `${q}${structure ? ` — ${structure}` : ""}`,
    at: Date.now(),
  };
}

function governorMessage(v: {
  value: string;
  chip: string;
  confidence: number;
  rationale: string;
}): ChatMessage {
  return {
    id: mid("gov"),
    agent: "governor",
    title: "Final Governor",
    stance: v.value,
    text: v.rationale || `Verdict: ${v.value} (${Math.round(v.confidence * 100)}%)`,
    at: Date.now(),
  };
}

export const useSwarmStore = create<SwarmState>((set, get) => ({
  caseId: null,
  agents: { ...EMPTY_AGENT },
  timeline: [],
  debate: null,
  lead: null,
  verdict: null,
  progress: 0,
  chatLog: [],
  lastChatId: null,
  displayedCount: 0,
  replayMode: false,
  reset: (caseId) =>
    set({
      caseId,
      agents: { ...EMPTY_AGENT },
      timeline: [],
      debate: null,
      lead: null,
      verdict: null,
      progress: 0,
      chatLog: [],
      lastChatId: null,
      displayedCount: 0,
      replayMode: false,
    }),
  beginReplay: () => {
    // Rewind the reveal to 0 but KEEP the existing chatLog so the user sees the
    // previous run replay immediately. When fresh data arrives mid-replay,
    // setCase swaps chatLog in place and the ticker continues.
    set({
      displayedCount: 0,
      replayMode: true,
      lastChatId: null,
    });
  },
  tickReplay: () => {
    const s = get();
    if (!s.replayMode) return;
    const next = Math.min(s.displayedCount + 1, s.chatLog.length);
    if (next === s.displayedCount) return;
    const lastId = next > 0 ? s.chatLog[next - 1]?.id ?? null : null;
    set({ displayedCount: next, lastChatId: lastId });
    if (next >= s.chatLog.length) {
      set({ replayMode: false });
    }
  },
  skipReplay: () => {
    const s = get();
    set({
      displayedCount: s.chatLog.length,
      replayMode: false,
      lastChatId: s.chatLog.length ? s.chatLog[s.chatLog.length - 1].id : null,
    });
  },
  setCase: (c) => {
    const agents: Record<AgentKey, { state: AgentState; position?: Position }> = { ...EMPTY_AGENT };
    c.positions.forEach((p) => {
      agents[p.agent_key] = { state: "done", position: p };
    });
    if (c.lead) agents.lead = { state: "done" };
    if (c.final_decision) agents.governor = { state: "done" };

    const chatLog: ChatMessage[] = [];
    c.positions.forEach((p) => chatLog.push(specialistMessage(p)));
    if (c.debate?.has_conflict) {
      chatLog.push(debateMessage(c.debate.conflict_pairs || [], c.debate.unique_topics || []));
    }
    if (c.lead) {
      chatLog.push(leadMessage(c.lead.reframed_question, c.lead.proposed_structure));
    }
    if (c.final_decision) {
      chatLog.push(
        governorMessage({
          value: c.final_decision.verdict,
          chip: c.final_decision.chip_label,
          confidence: c.final_decision.confidence,
          rationale: c.final_decision.rationale,
        }),
      );
    }

    const prev = get();
    const replaying = prev.replayMode;
    set({
      caseId: c.id,
      agents,
      timeline: [],
      debate: c.debate
        ? { pairs: c.debate.conflict_pairs || [], topics: c.debate.unique_topics || [] }
        : null,
      lead: c.lead
        ? { question: c.lead.reframed_question, structure: c.lead.proposed_structure, meters: c.lead.meters }
        : null,
      verdict: c.final_decision
        ? {
            value: c.final_decision.verdict,
            chip: c.final_decision.chip_label,
            confidence: c.final_decision.confidence,
            rationale: c.final_decision.rationale,
          }
        : null,
      progress: c.final_decision ? 100 : c.positions.length ? Math.min(85, c.positions.length * 12) : 0,
      chatLog,
      // During replay, keep displayedCount frozen so the ticker reveals messages one-by-one.
      // Otherwise (fresh load or mid-stream event append), fast-forward to the current length.
      displayedCount: replaying ? prev.displayedCount : chatLog.length,
      lastChatId: replaying
        ? prev.displayedCount > 0
          ? chatLog[prev.displayedCount - 1]?.id ?? null
          : null
        : chatLog.length
          ? chatLog[chatLog.length - 1].id
          : null,
    });
  },
  handleEvent: (evt) => {
    const type = String(evt.type || "");
    const state = get();
    switch (type) {
      case "swarm.started": {
        set({ progress: 8, timeline: [makeTimeline("swarm", "Swarm ignited", "Specialists fanning out.")] });
        return;
      }
      case "agent.started": {
        const key = String(evt.agent_key) as AgentKey;
        set({
          agents: { ...state.agents, [key]: { state: "thinking" } },
          progress: Math.max(state.progress, 14),
        });
        return;
      }
      case "agent.completed": {
        const key = String(evt.agent_key) as AgentKey;
        const position: Position = {
          agent_key: key,
          display_name: String(evt.display_name || key),
          stance: (evt.stance as Position["stance"]) || "review",
          score: Number(evt.score || 0),
          confidence: Number(evt.confidence || 0),
          rationale: String(evt.rationale || ""),
          flags: (evt.flags as Position["flags"]) || [],
          key_metrics: (evt.key_metrics as Position["key_metrics"]) || {},
          dissent_signal: {},
          evidence_refs: [],
          latency_ms: Number(evt.latency_ms || 0),
        };
        if (key === "lead" || key === "governor") {
          set({
            agents: { ...state.agents, [key]: { state: "done", position } },
            progress: Math.min(95, state.progress + 5),
          });
          return;
        }
        const msg = specialistMessage(position);
        set({
          agents: { ...state.agents, [key]: { state: "done", position } },
          progress: Math.min(78, state.progress + 10),
          chatLog: [...state.chatLog, msg],
          displayedCount: state.chatLog.length + 1,
          lastChatId: msg.id,
        });
        return;
      }
      case "debate.detected": {
        const pairs = (evt.conflict_pairs as [string, string, number, string][]) || [];
        const topics = (evt.topics as string[]) || [];
        const msg = debateMessage(pairs, topics);
        set({
          debate: { pairs, topics },
          timeline: [
            ...state.timeline,
            makeTimeline("debate", "Debate detected", topics.join(", ")),
          ],
          progress: 82,
          chatLog: [...state.chatLog, msg],
          displayedCount: state.chatLog.length + 1,
          lastChatId: msg.id,
        });
        return;
      }
      case "lead.reconciled": {
        const q = String(evt.reframed_question || "");
        const structure = String(evt.proposed_structure || "");
        const msg = leadMessage(q, structure);
        set({
          lead: {
            question: q,
            structure,
            meters: (evt.meters as Record<string, number>) || {},
          },
          timeline: [...state.timeline, makeTimeline("lead", "Lead reframed tradeoff", q)],
          progress: 90,
          chatLog: [...state.chatLog, msg],
          displayedCount: state.chatLog.length + 1,
          lastChatId: msg.id,
        });
        return;
      }
      case "decision.final": {
        const payload = {
          value: String(evt.verdict || ""),
          chip: String(evt.chip_label || ""),
          confidence: Number(evt.confidence || 0),
          rationale: String(evt.rationale || ""),
        };
        const msg = governorMessage(payload);
        set({
          verdict: payload,
          timeline: [
            ...state.timeline,
            makeTimeline("governor", `Governor: ${payload.value}`, payload.rationale),
          ],
          progress: 100,
          chatLog: [...state.chatLog, msg],
          displayedCount: state.chatLog.length + 1,
          lastChatId: msg.id,
        });
        return;
      }
      default:
        return;
    }
  },
}));

function makeTimeline(id: string, title: string, body: string) {
  return { id: `${id}-${Date.now()}`, title, body, at: new Date().toISOString() };
}
