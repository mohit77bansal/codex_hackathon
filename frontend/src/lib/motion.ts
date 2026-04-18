import type { Transition, Variants } from "framer-motion";

/**
 * Shared motion tokens from motion_design_prompt.md
 *
 * - default spring for normal transitions
 * - decisive spring for arrivals / climactic moments
 * - gentle spring for ambient motion
 * - reveal ease for deliberate entrances
 */
export const springs = {
  default: { type: "spring", stiffness: 260, damping: 26 } as Transition,
  decisive: { type: "spring", stiffness: 400, damping: 30 } as Transition,
  gentle: { type: "spring", stiffness: 120, damping: 20 } as Transition,
};

export const eases = {
  reveal: [0.16, 1, 0.3, 1] as [number, number, number, number],
  sharp: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export const enterFromBottom: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: eases.reveal } },
};

export const staggerChildren: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

export const agentEnter: Variants = {
  hidden: { opacity: 0, scale: 0.85, rotateX: -10 },
  show: {
    opacity: 1,
    scale: 1,
    rotateX: 0,
    transition: { type: "spring", stiffness: 300, damping: 22 },
  },
};

export const verdictPop: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.7, ease: eases.reveal },
  },
};
