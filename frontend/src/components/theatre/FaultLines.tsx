import { motion } from "framer-motion";

import type { AgentKey } from "../../lib/types";

interface Props {
  conflictPairs: [string, string, number, string][];
}

// Position of each agent card on a relative 100x100 SVG grid (matches ConsensusHub).
const AGENT_POS: Record<string, { x: number; y: number; side: "left" | "right" }> = {
  bureau: { x: 8, y: 18, side: "left" },
  bank: { x: 8, y: 50, side: "left" },
  fraud: { x: 8, y: 82, side: "left" },
  income: { x: 92, y: 18, side: "right" },
  policy: { x: 92, y: 50, side: "right" },
  behaviour: { x: 92, y: 82, side: "right" },
};

/**
 * Renders a fault line between each conflicting agent pair.
 * Inspired by motion_design_prompt.md §5: disagreement is spatial.
 */
export function FaultLines({ conflictPairs }: Props) {
  if (!conflictPairs.length) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="faultGrad" x1="0" x2="1">
          <stop offset="0%" stopColor="#fb7185" stopOpacity="0" />
          <stop offset="50%" stopColor="#fb7185" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
        </linearGradient>
      </defs>
      {conflictPairs.map(([a, b, strength, topic], idx) => {
        const pa = AGENT_POS[a as AgentKey];
        const pb = AGENT_POS[b as AgentKey];
        if (!pa || !pb) return null;
        const midX = (pa.x + pb.x) / 2;
        const midY = (pa.y + pb.y) / 2;
        // Curve outward so lines don't overlap the gauge
        const ctrlX = pa.side === pb.side ? midX + (pa.side === "left" ? -12 : 12) : midX;
        const ctrlY = midY;
        const opacity = 0.2 + strength * 0.7;
        return (
          <g key={`${a}-${b}-${idx}`}>
            <motion.path
              d={`M ${pa.x} ${pa.y} Q ${ctrlX} ${ctrlY} ${pb.x} ${pb.y}`}
              fill="none"
              stroke="url(#faultGrad)"
              strokeWidth={0.4 + strength * 0.6}
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: idx * 0.1 }}
            />
            <motion.circle
              cx={midX}
              cy={midY}
              r={0.6 + strength * 0.6}
              fill="#fb7185"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.8, 1.3, 0.8] }}
              transition={{
                duration: 2.4 - strength,
                repeat: Infinity,
                ease: "easeInOut",
                delay: idx * 0.1,
              }}
            />
            <title>{`${a} ↔ ${b} · ${topic} · ${(strength * 100).toFixed(0)}%`}</title>
          </g>
        );
      })}
    </svg>
  );
}
