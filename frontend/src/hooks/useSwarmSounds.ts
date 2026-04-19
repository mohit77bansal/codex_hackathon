import { useEffect, useRef } from "react";

import { play } from "../lib/sound";
import { useSwarmStore } from "../store/swarmStore";

/**
 * Subscribes to swarmStore and plays a cue whenever a new chat message becomes
 * visible (chatLog index reveals via replay OR live SSE append). Picking the cue
 * off the just-revealed message keeps sound and visuals perfectly in lockstep.
 *
 * Cue mapping:
 * - specialist agent bubble → "logged" chime
 * - debate bubble → "debate" minor third
 * - lead bubble → "leadPad" warm interval
 * - governor bubble → chord keyed to the verdict stance
 */
export function useSwarmSounds() {
  const prevCount = useRef(0);
  const prevCaseId = useRef<string | null>(null);

  useEffect(() => {
    return useSwarmStore.subscribe((s) => {
      // New case → reset counter without firing sounds.
      if (s.caseId !== prevCaseId.current) {
        prevCaseId.current = s.caseId;
        prevCount.current = s.displayedCount;
        return;
      }

      if (s.displayedCount <= prevCount.current) {
        prevCount.current = s.displayedCount;
        return;
      }

      // For each newly revealed message, play its associated cue.
      for (let i = prevCount.current; i < s.displayedCount; i += 1) {
        const msg = s.chatLog[i];
        if (!msg) continue;
        if (msg.agent === "debate") {
          play("debate");
        } else if (msg.agent === "lead") {
          play("leadPad");
        } else if (msg.agent === "governor") {
          const verdictVal = (msg.stance || s.verdict?.value || "").toLowerCase();
          if (verdictVal === "approve") play("approve");
          else if (verdictVal === "reject") play("reject");
          else play("conditional");
        } else {
          play("logged");
        }
      }
      prevCount.current = s.displayedCount;
    });
  }, []);
}
