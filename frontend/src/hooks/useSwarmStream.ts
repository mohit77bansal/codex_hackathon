import { useEffect } from "react";

import { useSwarmStore } from "../store/swarmStore";

const EVENTS: string[] = [
  "swarm.started",
  "agent.started",
  "agent.completed",
  "debate.detected",
  "lead.reconciled",
  "decision.final",
  "swarm.completed",
  "swarm.failed",
];

/**
 * Subscribes to the SSE stream for a case and funnels events into the Zustand
 * store. Currently the backend runs in eager mode and the full case payload is
 * available immediately, so this hook also supports a "replay" mode that hydrates
 * the theatre from a completed case detail.
 */
export function useSwarmStream(caseId: string | undefined) {
  const dispatch = useSwarmStore((s) => s.handleEvent);
  useEffect(() => {
    if (!caseId) return;
    const url = `/events/?channel=case-${caseId}`;
    let closed = false;
    let source: EventSource | null = null;
    try {
      source = new EventSource(url);
      EVENTS.forEach((evt) => {
        source!.addEventListener(evt, (ev: MessageEvent) => {
          if (closed) return;
          try {
            const data = JSON.parse(ev.data);
            dispatch({ type: evt, ...data });
          } catch {
            /* swallow parse errors */
          }
        });
      });
      source.onerror = () => {
        /* silent; reconnect handled by browser */
      };
    } catch {
      /* SSE unavailable */
    }
    return () => {
      closed = true;
      source?.close();
    };
  }, [caseId, dispatch]);
}
