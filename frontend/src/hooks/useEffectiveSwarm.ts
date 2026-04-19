import { useMemo } from "react";

import type { AgentKey } from "../lib/types";
import { useSwarmStore } from "../store/swarmStore";
import type { AgentState } from "../store/swarmStore";

const SPECIALIST_KEYS: AgentKey[] = [
  "bureau",
  "bank",
  "fraud",
  "income",
  "policy",
  "behaviour",
];

export interface EffectiveSwarm {
  agents: Record<AgentKey, { state: AgentState; position?: ReturnType<typeof useSwarmStore.getState>["agents"]["bureau"]["position"] }>;
  debate: ReturnType<typeof useSwarmStore.getState>["debate"];
  lead: ReturnType<typeof useSwarmStore.getState>["lead"];
  verdict: ReturnType<typeof useSwarmStore.getState>["verdict"];
  isReplaying: boolean;
}

/**
 * Returns the swarm state as it should visually appear RIGHT NOW — honoring
 * frontend replay so agents, debate, lead, and verdict reveal in step with
 * the chat rail. When not replaying, this is a direct pass-through.
 */
export function useEffectiveSwarm(): EffectiveSwarm {
  const agents = useSwarmStore((s) => s.agents);
  const debate = useSwarmStore((s) => s.debate);
  const lead = useSwarmStore((s) => s.lead);
  const verdict = useSwarmStore((s) => s.verdict);
  const chatLog = useSwarmStore((s) => s.chatLog);
  const displayedCount = useSwarmStore((s) => s.displayedCount);
  const replayMode = useSwarmStore((s) => s.replayMode);

  return useMemo(() => {
    if (!replayMode) {
      return { agents, debate, lead, verdict, isReplaying: false };
    }

    // Build derived agent states: idle → thinking → done as messages reveal.
    const specialistState: Record<AgentKey, AgentState> = {
      bureau: "idle",
      bank: "idle",
      fraud: "idle",
      income: "idle",
      policy: "idle",
      behaviour: "idle",
      lead: "idle",
      governor: "idle",
    };
    let debateRevealed = false;
    let leadRevealed = false;
    let verdictRevealed = false;

    for (let i = 0; i < displayedCount; i += 1) {
      const m = chatLog[i];
      if (!m) continue;
      if (m.agent === "debate") debateRevealed = true;
      else if (m.agent === "lead") leadRevealed = true;
      else if (m.agent === "governor") verdictRevealed = true;
      else specialistState[m.agent as AgentKey] = "done";
    }

    // Mark the next not-yet-revealed specialist (if any) as "thinking" so its
    // card pulses while the user waits.
    for (let i = displayedCount; i < chatLog.length; i += 1) {
      const m = chatLog[i];
      if (!m) continue;
      if (m.agent === "debate" || m.agent === "lead" || m.agent === "governor") continue;
      const k = m.agent as AgentKey;
      if (specialistState[k] === "idle") {
        specialistState[k] = "thinking";
        break;
      }
    }
    // Any specialist with no message yet but whose turn is near → "thinking"
    // fallback so all 6 don't sit idle.
    if (displayedCount > 0 && SPECIALIST_KEYS.some((k) => specialistState[k] === "idle")) {
      for (const k of SPECIALIST_KEYS) {
        if (specialistState[k] !== "idle") continue;
        if (!chatLog.some((m) => m.agent === k)) continue;
        specialistState[k] = "thinking";
        break;
      }
    }

    const effectiveAgents = { ...agents } as EffectiveSwarm["agents"];
    (Object.keys(specialistState) as AgentKey[]).forEach((k) => {
      effectiveAgents[k] = {
        ...agents[k],
        state: specialistState[k],
        // Keep position object when revealed so the card can show score/stance.
        position: specialistState[k] === "done" ? agents[k].position : undefined,
      };
    });

    return {
      agents: effectiveAgents,
      debate: debateRevealed ? debate : null,
      lead: leadRevealed ? lead : null,
      verdict: verdictRevealed ? verdict : null,
      isReplaying: true,
    };
  }, [agents, debate, lead, verdict, chatLog, displayedCount, replayMode]);
}
