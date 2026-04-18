# Motion Design Prompt: Multi-Agent Credit Decision Platform

## Project Context

You are designing the motion system for a web application where multiple AI agents debate, argue, and collaborate to make credit decisions. The product needs to feel like watching minds think in real-time — not a dashboard, not a chatbot, but a living reasoning chamber where uncertainty, dissent, rule-following, and trade-offs are felt through motion, not just displayed.

The motion language must convey gravitas (this is finance), intelligence (these are reasoning agents), and tension (decisions have stakes). Every animation should earn its place by communicating state, reasoning, or relationship — never decoration for its own sake.

---

## Core Motion Principles

**Motion as meaning, not ornament.** Every transition should answer a question: What changed? Why? Who disagrees? How confident are we? If an animation doesn't convey information, remove it.

**Physical honesty.** Agents have weight. Arguments have momentum. Evidence has gravity. Use spring physics (stiffness 180-300, damping 20-30) rather than linear easings. Things should feel like they obey invisible physical laws — heavier claims settle slower, uncertain ones oscillate before resolving.

**Temporal hierarchy.** Fast (80-150ms) for acknowledgments and micro-feedback. Medium (250-400ms) for state changes and transitions. Slow (600-1200ms) for significant reveals, decisions, and emotional beats. Never animate everything at the same speed — it flattens the experience.

**Purposeful restraint.** This is a financial product, not a game. Motion should feel confident and deliberate, not bouncy or playful. Think Bloomberg Terminal meets Linear meets a Swiss watch — precise, intentional, premium.

---

## Motion Language by Concept

### 1. Agents Entering the Debate

When an agent joins or activates, they should feel like they're materializing into a shared conceptual space. Not a fade-in. Not a slide. Something more deliberate.

**Execution:** Agent avatar scales from 0.85 with a slight overshoot (1.02 → 1.0) while a thin ring expands outward and dissipates. A subtle "presence glow" pulses once, then settles into a quiet ambient breathing (2% scale oscillation over 4s). The agent's name types in character-by-character at 30ms per character using a monospace transitional font. Total entrance: ~800ms.

**Why it works:** Communicates that agents are distinct entities with personalities, not UI chrome.

### 2. Arguing and Counter-Arguing

Arguments should feel like they carry force. When Agent A makes a claim and Agent B counters, the UI should register the collision.

**Execution:** Messages emerge from the agent's side with directional momentum — slight horizontal velocity that decays over 350ms. When a counter-argument lands, the opposing message briefly recoils (translate 4px away from the new argument) while the new one arrives. Use a subtle shadow bloom on the "striking" message for 200ms before it settles. If the argument is particularly strong (high confidence + novel evidence), add a brief horizontal ripple through the debate thread.

**Visual metaphor:** Think fencing, not brawling. Precision strikes, not chaos.

### 3. Following Rules / Policy Invocation

When an agent cites a rule or policy, the rule itself should come alive — not just get highlighted, but feel summoned.

**Execution:** The relevant policy card in the sidebar briefly unsheathes — translates 8px toward the debate, its border gains a 2px luminous edge that travels around the card perimeter once (700ms), then settles. A thin connecting line draws from the policy to the citing message in 400ms using a bezier curve, then fades its midsection after 1.5s leaving only the endpoints "tethered." When multiple rules are invoked, they stagger by 120ms each.

**Why it works:** Makes the invisible scaffolding of reasoning visible. Users see *what* is being used to decide.

### 4. Uncertainty and Confidence

This is the hardest and most important motion challenge. Confidence is a continuous variable — motion must reflect that continuously, not as discrete states.

**Execution for uncertainty:**
- Low-confidence text renders with a subtle 0.5px blur that breathes (blur 0.3 → 0.7 over 3s, infinite)
- Numeric values oscillate within their uncertainty band — a "73% ± 8%" value literally drifts between 65% and 81% with organic noise, slowing as confidence increases
- Confidence bars aren't solid — they're distributions. The bar has a fuzzy gradient edge that's wider when uncertain, sharper when certain
- On hover, the distribution expands to reveal its full shape

**Execution for confidence resolution:**
- When new evidence arrives, uncertainty visualizations visibly *tighten* — the fuzzy edges contract, oscillations dampen, blur reduces. This happens over 800-1200ms with spring physics, so you feel the epistemic update

**Why it works:** Users develop intuition for how sure the system is without reading numbers. Uncertainty becomes visceral.

### 5. Dissent and Disagreement

When agents disagree, the interface itself should register the fracture.

**Execution:**
- Agents in agreement subtly drift closer in the layout (4-8px) over 600ms
- Agents in disagreement drift apart, and a hairline "fault line" appears between them — a 1px gradient line that's brighter at points of highest disagreement
- The disagreement magnitude modulates the fault line's intensity (opacity 0.2 → 0.9) and its "tension" (a subtle pulse frequency that increases with conflict)
- When disagreement is resolved, the fault line heals — it contracts from both ends toward the middle and dissipates in 500ms
- Extreme dissent can trigger a brief "shudder" in the layout — agents shift 2px away from each other in a damped oscillation

**Why it works:** Disagreement is spatial. You can see it in the geometry of the interface.

### 6. Trade-offs

Trade-offs are about weight and balance. Motion should make you feel the mass of competing factors.

**Execution:**
- A trade-off visualization uses a central fulcrum with factors on either side
- Factors have visible weight — larger, heavier factors cause the fulcrum to tilt with real spring physics (inertia matters, so it overshoots and settles)
- When a new factor is added, it drops onto its side and the scale re-balances over 900ms with realistic damping
- Factors can be "lifted" by the user for inspection — they translate upward with a slight rotation, revealing underlying evidence
- If two factors are in tension (e.g., "creditworthiness" vs "regulatory risk"), a visible tether connects them that stretches and contracts as their relative weights shift

**Why it works:** Trade-offs are a felt experience. Users can see the system grappling with competing goods.

### 7. Reasoning Chains Unfolding

As an agent thinks through a problem, the reasoning should unfold like a sentence being spoken — with rhythm.

**Execution:**
- Reasoning steps appear one at a time with 180ms stagger
- Each step fades in from 0 opacity while translating up 6px — but the motion isn't uniform. Use an asymmetric ease (fast out of invisibility, slow into position) so each step feels "thought through"
- Connecting arrows draw in after each step with a 80ms delay, using a path-drawing animation (stroke-dashoffset)
- If the agent revises an earlier step, that step briefly highlights, dissolves, and is replaced — the subsequent chain "catches up" by shifting position with a spring

**Why it works:** Thought has a pace. Showing that pace makes agents feel cognitive, not robotic.

### 8. The Decision Moment

When the agents converge on a credit decision, this is the climactic beat. It must feel earned.

**Execution:**
- Before the decision: the interface "holds its breath" — all ambient animations slow by 50%, opacity of non-essential elements drops to 0.6
- The decision card emerges from the center — scale from 0.92 to 1.0 over 700ms with a refined spring. A thin horizontal line sweeps across it revealing the verdict
- If unanimous: agents visibly align, their avatars glow softly in sync
- If split: the dissenting agents remain visually distinct, their minority position preserved with a "dissenting opinion" indicator that pulses gently
- Key numbers (approved amount, rate, terms) count up from zero with decelerating speed — ending on the exact value with a subtle "lock" micro-animation

**Why it works:** Decisions have weight. The motion makes users feel the finality.

---

## Technical Implementation Guidelines

**Libraries:**
- Framer Motion for component-level animations and gestures
- GSAP for complex choreographed sequences (especially the decision moment)
- React Flow for the reasoning graph with custom edge animations
- Rive for agent avatar micro-expressions that respond to state
- Lenis for smooth scroll behavior across the debate thread
- Custom GLSL shaders for ambient background effects that subtly respond to debate intensity

**Performance rules:**
- Never animate layout properties directly — use transform and opacity
- Respect `prefers-reduced-motion` — provide a restrained alternative (state changes still happen, but with 80ms fades instead of spring physics)
- Target 60fps on mid-range hardware; degrade ambient animations first under load
- Use `will-change` sparingly and remove after animations complete

**Easing reference:**
- Default spring: `{ type: "spring", stiffness: 260, damping: 26 }`
- Decisive spring (for arrivals): `{ type: "spring", stiffness: 400, damping: 30 }`
- Gentle spring (for ambient): `{ type: "spring", stiffness: 120, damping: 20 }`
- Sharp ease (for dismissals): `cubic-bezier(0.4, 0, 0.2, 1)` at 200ms
- Reveal ease (for entrances): `cubic-bezier(0.16, 1, 0.3, 1)` at 600ms

---

## Sound Design Consideration

Motion is more powerful with sound. Each major motion beat should have an optional audio counterpart — not skeuomorphic clicks, but abstract tonal cues. Think the audio design of Hans Zimmer's Dune score meeting the precision of iOS system sounds. A soft tonal "emergence" when agents join. A subtle resonant "tension" note when dissent appears. A clean "resolution" chord when decisions land. All dismissible, all optional, never jarring.

---

## What to Avoid

- Bouncy, playful animations — this is not a consumer app
- Decorative motion that doesn't carry information
- Uniform animation speeds across different concept types
- Particle effects unless they carry semantic meaning
- Animations that repeat too frequently and become noise
- Motion that delays the user's ability to act — never trap someone in an animation
- Generic fade-ins; every entrance should be specific to what's entering
- Using the same motion vocabulary for agreement and disagreement

---

## North Star

A user should be able to glance at the screen for two seconds and feel — not read, *feel* — whether the agents are converging or diverging, certain or uncertain, invoking rules or reasoning from first principles. The motion is the second language of the product. Master it, and the interface becomes a mind you can watch think.
