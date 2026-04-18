"""Lead Reviewer and Final Governor agents."""
from __future__ import annotations

import json
import textwrap
from typing import Any

from pydantic import BaseModel

from apps.agents.base import AgentContext, BaseAgent, rng_for
from apps.agents.features import case_summary
from apps.agents.schemas import FinalDecisionOutput, LeadReconciliationOutput
from apps.cases.models import Case
from apps.swarm.models import (
    AgentPosition,
    Debate,
    FinalDecision,
    LeadReconciliation,
)


STANCE_ALIGNMENT = {"approve": 1, "conditional": 0, "review": 0, "reject": -1}


def compute_debate(case: Case) -> Debate:
    """Compute a conflict matrix from stored AgentPositions."""
    positions = list(
        AgentPosition.objects.filter(agent_run__case=case)
        .select_related("agent_run")
    )
    pairs: list[list[Any]] = []
    topics: set[str] = set()
    for i, a in enumerate(positions):
        for b in positions[i + 1 :]:
            align_a = STANCE_ALIGNMENT.get(a.stance, 0)
            align_b = STANCE_ALIGNMENT.get(b.stance, 0)
            strength = abs(align_a - align_b) / 2.0
            dissent_a = float((a.dissent_signal or {}).get("strength", 0) or 0)
            dissent_b = float((b.dissent_signal or {}).get("strength", 0) or 0)
            strength = max(strength, 0.5 * max(dissent_a, dissent_b)) if strength else max(dissent_a, dissent_b) * 0.6
            if strength >= 0.3:
                topic = (a.dissent_signal or {}).get("topic") or (b.dissent_signal or {}).get("topic") or "stance"
                pairs.append([a.agent_run.agent_key, b.agent_run.agent_key, round(strength, 2), topic])
                topics.add(topic)

    debate, _ = Debate.objects.update_or_create(
        case=case,
        defaults={
            "conflict_pairs": pairs,
            "unique_topics": sorted(topics),
            "has_conflict": bool(pairs),
        },
    )
    return debate


def _positions_payload(case: Case) -> list[dict[str, Any]]:
    positions = AgentPosition.objects.filter(agent_run__case=case).select_related("agent_run")
    return [
        {
            "agent": p.agent_run.agent_key,
            "stance": p.stance,
            "confidence": p.confidence,
            "score": p.score,
            "rationale": p.rationale,
            "flags": p.flags,
            "dissent_signal": p.dissent_signal,
            "key_metrics": p.key_metrics,
        }
        for p in positions
    ]


class LeadReviewer(BaseAgent):
    agent_key = "lead"
    display_name = "Lead Reviewer"
    model_tier = "orchestrator"
    temperature = 0.3

    def build_features(self, case: Case) -> dict[str, Any]:
        debate = compute_debate(case)
        return {
            "case": case_summary(case),
            "positions": _positions_payload(case),
            "debate": {
                "has_conflict": debate.has_conflict,
                "conflict_pairs": debate.conflict_pairs,
                "topics": debate.unique_topics,
            },
        }

    def system_prompt(self) -> str:
        return textwrap.dedent(
            """
            You are the Lead Reviewer in a credit underwriting swarm.
            You read 6 specialist positions plus a conflict matrix and reconcile them.
            Your goal is NOT to pick a side — it is to reframe the real tradeoff,
            propose a structure (e.g. conditional approval with guardrails), and surface
            residual risks. Emit numeric meters 0-100 for:
              uncertainty  : how incomplete is the evidence
              conflict     : how much do specialists disagree
              pressure     : commercial / urgency pressure on the decision
              reversibility: how easy is it to unwind a wrong call (higher = more reversible)

            Return JSON matching:
            {
              "reframed_question": str,
              "proposed_structure": str,
              "conditions": [str, ...],
              "residual_risks": [str, ...],
              "escalation_required": bool,
              "meters": {"uncertainty": int, "conflict": int, "pressure": int, "reversibility": int}
            }
            """
        ).strip()

    def user_prompt(self, ctx: AgentContext, extra: dict[str, Any] | None = None) -> str:
        return f"Specialist positions + debate:\n{json.dumps(ctx.features, indent=2, default=str)}"

    def output_schema(self) -> type[BaseModel]:
        return LeadReconciliationOutput

    def synthetic(self, ctx: AgentContext, seed: int) -> BaseModel:
        rng = rng_for(seed)
        positions = ctx.features["positions"]
        has_conflict = ctx.features["debate"]["has_conflict"]
        approves = sum(1 for p in positions if p["stance"] == "approve")
        rejects = sum(1 for p in positions if p["stance"] == "reject")
        conditions = []

        # surface policy conditions
        for p in positions:
            if p["agent"] == "policy" and p["stance"] == "conditional":
                conditions.extend([
                    "Risk-based pricing bump (+100-200 bps)",
                    "Reduce tenure to 24 months",
                    "Quarterly compliance review",
                ])
        if any(p["agent"] == "bank" and p["stance"] != "approve" for p in positions):
            conditions.append("Require buyer-confirmed invoices for drawdown")
        if any(p["agent"] == "fraud" and p["stance"] != "approve" for p in positions):
            conditions.append("Secondary identity verification with physical visit")

        residuals = []
        for p in positions:
            for flag in p.get("flags", []) or []:
                if flag.get("severity") == "high":
                    residuals.append(f"{p['agent']}: {flag.get('message')}")

        conflict_score = min(100, int(abs(approves - rejects) * 18 + (40 if has_conflict else 10)))
        uncertainty_score = min(100, 55 + rng.randint(-10, 10) + (10 if has_conflict else 0))
        pressure_score = 70 + rng.randint(-10, 10)
        reversibility = 35 + rng.randint(-8, 8)

        if rejects >= 3:
            question = "Is this case salvageable with a conditional structure or should we reject now?"
            structure = "Reject this cycle; invite re-application after 6 months with additional mitigants."
            escalation = True
        elif approves >= 5 and not has_conflict:
            question = "Is there any hidden concentration or exception we are missing before a clean approve?"
            structure = "Approve within standard terms; monitor portfolio concentration and vintage mix."
            escalation = False
        else:
            question = "Can a conditional structure contain downside without killing commercial momentum?"
            structure = "Conditional approval with tighter tenure, risk-based pricing, and buyer-confirmed drawdown."
            escalation = False

        return LeadReconciliationOutput(
            reframed_question=question,
            proposed_structure=structure,
            conditions=sorted(set(conditions))[:5] or ["Standard portfolio monitoring"],
            residual_risks=residuals[:5] or ["No high-severity residuals"],
            escalation_required=escalation,
            meters={
                "uncertainty": uncertainty_score,
                "conflict": conflict_score,
                "pressure": pressure_score,
                "reversibility": reversibility,
            },
        )

    def persist_output(self, ctx: AgentContext, data: dict[str, Any]) -> None:
        LeadReconciliation.objects.update_or_create(
            case=ctx.case,
            defaults={
                "agent_run": ctx.agent_run,
                "reframed_question": data["reframed_question"],
                "proposed_structure": data["proposed_structure"],
                "conditions": data.get("conditions", []),
                "residual_risks": data.get("residual_risks", []),
                "escalation_required": data.get("escalation_required", False),
                "meters": data.get("meters", {}),
            },
        )


class FinalGovernor(BaseAgent):
    agent_key = "governor"
    display_name = "Final Governor"
    model_tier = "orchestrator"
    temperature = 0.25

    def build_features(self, case: Case) -> dict[str, Any]:
        lead = getattr(case, "lead_reconciliation", None)
        return {
            "case": case_summary(case),
            "positions": _positions_payload(case),
            "lead": {
                "reframed_question": lead.reframed_question if lead else "",
                "proposed_structure": lead.proposed_structure if lead else "",
                "conditions": lead.conditions if lead else [],
                "residual_risks": lead.residual_risks if lead else [],
                "escalation_required": lead.escalation_required if lead else False,
                "meters": lead.meters if lead else {},
            } if lead else None,
        }

    def system_prompt(self) -> str:
        return textwrap.dedent(
            """
            You are the Final Governor of a credit underwriting swarm.
            You make the accountable call based on specialist positions and the lead's
            reconciliation. You may approve, reject, conditionally approve, or escalate
            if evidence is insufficient. Produce rationale defensible to an auditor.

            Return JSON:
            {
              "verdict": "approve|reject|conditional|escalate",
              "chip_label": str,
              "rationale": str,
              "confidence": 0..1 float,
              "constraint_fit": "very high|high|medium|low",
              "audit_strength": "very strong|strong|medium|weak",
              "conditions": [str],
              "review_checkpoints": [str]
            }
            """
        ).strip()

    def user_prompt(self, ctx: AgentContext, extra: dict[str, Any] | None = None) -> str:
        return f"Swarm artifacts:\n{json.dumps(ctx.features, indent=2, default=str)}"

    def output_schema(self) -> type[BaseModel]:
        return FinalDecisionOutput

    def synthetic(self, ctx: AgentContext, seed: int) -> BaseModel:
        rng = rng_for(seed)
        positions = ctx.features["positions"]
        lead = ctx.features.get("lead") or {}
        approves = sum(1 for p in positions if p["stance"] == "approve")
        rejects = sum(1 for p in positions if p["stance"] == "reject")
        conditionals = sum(1 for p in positions if p["stance"] == "conditional")
        policy = next((p for p in positions if p["agent"] == "policy"), None)

        if policy and policy["stance"] == "reject":
            verdict = "reject"
            chip = "Policy hard boundary"
        elif lead.get("escalation_required"):
            verdict = "escalate"
            chip = "Human escalation"
        elif rejects >= 3:
            verdict = "reject"
            chip = "Portfolio & risk signals"
        elif approves >= 5 and conditionals == 0:
            verdict = "approve"
            chip = "Clean consensus"
        else:
            verdict = "conditional"
            chip = "Governed exception"

        score_map = {"approve": 88, "conditional": 74, "reject": 40, "escalate": 58}
        confidence = round(min(0.95, 0.6 + score_map.get(verdict, 60) / 200 + rng.uniform(-0.03, 0.03)), 3)

        conditions = lead.get("conditions") or []
        checkpoints = [
            "90-day performance review",
            "Quarterly exposure review for sector concentration",
        ]
        if verdict == "conditional":
            checkpoints.insert(0, "30-day post-disbursement health check")

        rationale_parts = [
            f"Final verdict: {verdict}.",
            f"Specialists: {approves} approve, {conditionals} conditional, {rejects} reject.",
        ]
        if lead.get("reframed_question"):
            rationale_parts.append(f"Lead framing: {lead['reframed_question']}")
        if verdict == "conditional":
            rationale_parts.append("Approval is governed — guardrails preserve upside while containing downside.")
        elif verdict == "approve":
            rationale_parts.append("Evidence is consistent; standard terms are sufficient.")
        elif verdict == "reject":
            rationale_parts.append("Signals do not meet threshold. Re-application possible with mitigants.")
        else:
            rationale_parts.append("Evidence gap prevents a confident decision; escalate to senior review.")

        return FinalDecisionOutput(
            verdict=verdict,
            chip_label=chip,
            rationale=" ".join(rationale_parts),
            confidence=confidence,
            constraint_fit="very high" if verdict == "approve" else "high" if verdict == "conditional" else "medium",
            audit_strength="very strong" if verdict == "conditional" else "strong",
            conditions=conditions if verdict in {"conditional", "approve"} else [],
            review_checkpoints=checkpoints,
        )

    def persist_output(self, ctx: AgentContext, data: dict[str, Any]) -> None:
        FinalDecision.objects.create(
            case=ctx.case,
            agent_run=ctx.agent_run,
            verdict=data["verdict"],
            chip_label=data.get("chip_label", ""),
            rationale=data["rationale"],
            confidence=data["confidence"],
            constraint_fit=data.get("constraint_fit", ""),
            audit_strength=data.get("audit_strength", ""),
            conditions=data.get("conditions", []),
            review_checkpoints=data.get("review_checkpoints", []),
        )
