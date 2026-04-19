/**
 * Lightweight Web Audio kit for the Decision Swarm theatre.
 *
 * No external assets — every cue is synthesized with OscillatorNode.
 * The kit is lazily created on first user gesture (browser autoplay policy),
 * and mute state is persisted in localStorage so it survives reloads.
 */

type Cue =
  | "tick"
  | "activate"
  | "logged"
  | "debate"
  | "leadPad"
  | "approve"
  | "reject"
  | "conditional";

const STORAGE_KEY = "swarm-sound-muted";
const MASTER_GAIN = 0.09;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted: boolean = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
})();

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    const c = new Ctor();
    const m = c.createGain();
    m.gain.value = MASTER_GAIN;
    m.connect(c.destination);
    ctx = c;
    master = m;
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

/** Nudge the audio context on a trusted gesture. Call on first user click. */
export function unlockAudio() {
  const c = ensureContext();
  if (c && c.state === "suspended") {
    c.resume().catch(() => {});
  }
}

function envelope(
  c: AudioContext,
  destination: AudioNode,
  attack = 0.008,
  decay = 0.25,
  peak = 1,
): GainNode {
  const g = c.createGain();
  const now = c.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
  g.connect(destination);
  return g;
}

function tone({
  freq,
  type = "sine",
  attack = 0.008,
  decay = 0.25,
  peak = 1,
  delay = 0,
  detune = 0,
}: {
  freq: number;
  type?: OscillatorType;
  attack?: number;
  decay?: number;
  peak?: number;
  delay?: number;
  detune?: number;
}) {
  if (muted) return;
  const c = ensureContext();
  if (!c || !master) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (detune) osc.detune.setValueAtTime(detune, now);
  const env = envelope(c, master, attack, decay, peak);
  osc.connect(env);
  osc.start(now);
  osc.stop(now + attack + decay + 0.05);
}

function sweep({
  from,
  to,
  type = "sine",
  attack = 0.005,
  decay = 0.25,
  peak = 1,
  delay = 0,
}: {
  from: number;
  to: number;
  type?: OscillatorType;
  attack?: number;
  decay?: number;
  peak?: number;
  delay?: number;
}) {
  if (muted) return;
  const c = ensureContext();
  if (!c || !master) return;
  const now = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + attack + decay * 0.7);
  const env = envelope(c, master, attack, decay, peak);
  osc.connect(env);
  osc.start(now);
  osc.stop(now + attack + decay + 0.05);
}

export function play(cue: Cue) {
  if (muted) return;
  switch (cue) {
    case "tick":
      tone({ freq: 1200, type: "triangle", attack: 0.003, decay: 0.08, peak: 0.45 });
      return;
    case "activate":
      // Rising airy blip: agent summoned
      sweep({ from: 440, to: 680, type: "sine", attack: 0.005, decay: 0.22, peak: 0.7 });
      tone({
        freq: 1320,
        type: "triangle",
        attack: 0.002,
        decay: 0.16,
        peak: 0.18,
        delay: 0.02,
      });
      return;
    case "logged":
      // Soft bell: 880 + 1320 (octave + fifth)
      tone({ freq: 880, type: "sine", attack: 0.004, decay: 0.34, peak: 0.75 });
      tone({
        freq: 1320,
        type: "sine",
        attack: 0.004,
        decay: 0.3,
        peak: 0.35,
        delay: 0.01,
      });
      return;
    case "debate":
      // Minor third tension (E + G)
      tone({ freq: 329.63, type: "triangle", attack: 0.01, decay: 0.45, peak: 0.6 });
      tone({
        freq: 392.0,
        type: "triangle",
        attack: 0.01,
        decay: 0.45,
        peak: 0.55,
        delay: 0.04,
      });
      tone({
        freq: 164.81,
        type: "sine",
        attack: 0.02,
        decay: 0.55,
        peak: 0.35,
        delay: 0.04,
      });
      return;
    case "leadPad":
      // Warm interval pad (D + A)
      tone({ freq: 293.66, type: "sine", attack: 0.04, decay: 0.7, peak: 0.55 });
      tone({
        freq: 440.0,
        type: "sine",
        attack: 0.04,
        decay: 0.7,
        peak: 0.45,
        delay: 0.02,
      });
      tone({
        freq: 587.33,
        type: "triangle",
        attack: 0.06,
        decay: 0.6,
        peak: 0.25,
        delay: 0.06,
      });
      return;
    case "approve":
      // Major triad C-E-G rising arpeggio then held chord
      tone({ freq: 523.25, type: "sine", attack: 0.005, decay: 0.25, peak: 0.8 });
      tone({
        freq: 659.25,
        type: "sine",
        attack: 0.005,
        decay: 0.32,
        peak: 0.75,
        delay: 0.08,
      });
      tone({
        freq: 783.99,
        type: "sine",
        attack: 0.008,
        decay: 0.55,
        peak: 0.7,
        delay: 0.16,
      });
      tone({
        freq: 1046.5,
        type: "triangle",
        attack: 0.01,
        decay: 0.6,
        peak: 0.3,
        delay: 0.24,
      });
      return;
    case "reject":
      // Minor triad C-Eb-G descending
      tone({ freq: 783.99, type: "triangle", attack: 0.006, decay: 0.28, peak: 0.7 });
      tone({
        freq: 622.25,
        type: "triangle",
        attack: 0.008,
        decay: 0.35,
        peak: 0.75,
        delay: 0.08,
      });
      tone({
        freq: 523.25,
        type: "sine",
        attack: 0.01,
        decay: 0.6,
        peak: 0.7,
        delay: 0.16,
      });
      tone({
        freq: 261.63,
        type: "sine",
        attack: 0.02,
        decay: 0.8,
        peak: 0.45,
        delay: 0.16,
      });
      return;
    case "conditional":
      // Sus4 suspension resolving
      tone({ freq: 523.25, type: "sine", attack: 0.008, decay: 0.3, peak: 0.7 });
      tone({
        freq: 698.46,
        type: "sine",
        attack: 0.01,
        decay: 0.45,
        peak: 0.6,
        delay: 0.05,
      });
      tone({
        freq: 659.25,
        type: "sine",
        attack: 0.012,
        decay: 0.55,
        peak: 0.65,
        delay: 0.22,
      });
      return;
  }
}
