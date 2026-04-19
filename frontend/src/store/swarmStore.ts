import { create } from "zustand";

import type { AgentKey, CaseDetail, Position } from "../lib/types";

export type AgentState = "idle" | "thinking" | "done" | "failed";
export type SwarmPhase = "idle" | "running" | "complete";

interface SwarmState {
  caseId: string | null;
  phase: SwarmPhase;
  agents: Record<AgentKey, { state: AgentState; position?: Position }>;
  timeline: { id: string; title: string; body: string; at: string }[];
  debate: { pairs: [string, string, number, string][]; topics: string[] } | null;
  lead: { question: string; structure: string; meters: Record<string, number> } | null;
  verdict: { value: string; chip: string; confidence: number; rationale: string } | null;
  progress: number;
  setCase: (c: CaseDetail) => void;
  reset: (caseId: string) => void;
  handleEvent: (evt: Record<string, unknown>) => void;
}

const RUNNING_STATUSES = new Set(["running", "debating"]);
const COMPLETE_STATUSES = new Set(["decided", "approved", "rejected", "conditional", "escalated", "overridden"]);

function phaseFromCase(c: CaseDetail): SwarmPhase {
  if (c.final_decision || COMPLETE_STATUSES.has(c.status)) return "complete";
  if (RUNNING_STATUSES.has(c.status) || c.positions.length > 0) return "running";
  return "idle";
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

export const useSwarmStore = create<SwarmState>((set, get) => ({
  caseId: null,
  phase: "idle",
  agents: { ...EMPTY_AGENT },
  timeline: [],
  debate: null,
  lead: null,
  verdict: null,
  progress: 0,
  reset: (caseId) =>
    set({
      caseId,
      phase: "idle",
      agents: { ...EMPTY_AGENT },
      timeline: [],
      debate: null,
      lead: null,
      verdict: null,
      progress: 0,
    }),
  setCase: (c) => {
    const agents: Record<AgentKey, { state: AgentState; position?: Position }> = { ...EMPTY_AGENT };
    c.positions.forEach((p) => {
      agents[p.agent_key] = { state: "done", position: p };
    });
    if (c.lead) agents.lead = { state: "done" };
    if (c.final_decision) agents.governor = { state: "done" };
    set({
      caseId: c.id,
      phase: phaseFromCase(c),
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
    });
  },
  handleEvent: (evt) => {
    const type = String(evt.type || "");
    const state = get();
    switch (type) {
      case "swarm.started": {
        set({
          phase: "running",
          progress: 8,
          timeline: [makeTimeline("swarm", "Swarm ignited", "Specialists fanning out.")],
        });
        return;
      }
      case "agent.started": {
        const key = String(evt.agent_key) as AgentKey;
        const existing = state.agents[key];
        set({
          agents: {
            ...state.agents,
            [key]: { state: "thinking", position: existing?.position },
          },
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
        set({
          agents: { ...state.agents, [key]: { state: "done", position } },
          progress: Math.min(78, state.progress + 10),
        });
        return;
      }
      case "debate.detected": {
        set({
          debate: {
            pairs: (evt.conflict_pairs as [string, string, number, string][]) || [],
            topics: (evt.topics as string[]) || [],
          },
          timeline: [
            ...state.timeline,
            makeTimeline("debate", "Debate detected", `${((evt.topics as string[]) || []).join(", ")}`),
          ],
          progress: 82,
        });
        return;
      }
      case "lead.reconciled": {
        set({
          lead: {
            question: String(evt.reframed_question || ""),
            structure: String(evt.proposed_structure || ""),
            meters: (evt.meters as Record<string, number>) || {},
          },
          timeline: [...state.timeline, makeTimeline("lead", "Lead reframed tradeoff", String(evt.reframed_question || ""))],
          progress: 90,
        });
        return;
      }
      case "decision.final": {
        set({
          phase: "complete",
          verdict: {
            value: String(evt.verdict || ""),
            chip: String(evt.chip_label || ""),
            confidence: Number(evt.confidence || 0),
            rationale: String(evt.rationale || ""),
          },
          timeline: [...state.timeline, makeTimeline("governor", `Governor: ${evt.verdict}`, String(evt.rationale || ""))],
          progress: 100,
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
