"""The 6 specialist credit agents.

Each specialist:
1. Pre-processes domain features deterministically (features.py)
2. Renders a prompt with case context + features + policy snippet
3. Calls the LLM with a Pydantic-validated SpecialistPosition schema
4. On API absence, falls back to a deterministic synthetic position
5. Persists AgentRun + AgentPosition
"""
from __future__ import annotations

import json
import textwrap
from typing import Any

from pydantic import BaseModel

from apps.agents.base import AgentContext, BaseAgent, rng_for
from apps.agents.features import (
    bank_features,
    behaviour_features,
    case_summary,
    financial_features,
    fraud_features,
    income_features,
)
from apps.agents.schemas import (
    DissentSignal,
    Flag,
    SpecialistPosition,
)
from apps.cases.models import Case
from apps.policy.engine import evaluate as policy_evaluate
from apps.swarm.models import AgentPosition


def _persist_specialist(ctx: AgentContext, data: dict[str, Any]) -> None:
    AgentPosition.objects.create(
        agent_run=ctx.agent_run,
        stance=data["stance"],
        confidence=data["confidence"],
        score=data["score"],
        key_metrics=data.get("key_metrics", {}),
        flags=data.get("flags", []),
        rationale=data["rationale"],
        dissent_signal=data.get("dissent_signal", {}),
        evidence_refs=data.get("evidence_refs", []),
    )


def _heuristic_score(signals: list[tuple[str, float]]) -> tuple[str, int, float]:
    """Turn signal -> score tuples into (stance, score, confidence).

    Each signal is (name, value) where value is in [0, 1]. Their average becomes
    the base score (0-100). We add tiny pseudo-random jitter via seed to keep
    outputs feeling natural without losing determinism.
    """
    if not signals:
        return "review", 60, 0.6
    avg = sum(v for _, v in signals) / len(signals)
    score = int(round(avg * 100))
    if score >= 80:
        return "approve", score, min(0.95, 0.7 + avg * 0.25)
    if score >= 65:
        return "review", score, 0.6 + avg * 0.2
    return "reject", score, 0.6 + (1 - avg) * 0.2


class BureauAgent(BaseAgent):
    agent_key = "bureau"
    display_name = "Bureau Score Agent"

    def build_features(self, case: Case) -> dict[str, Any]:
        return {"case": case_summary(case), "bureau": financial_features(case)}

    def system_prompt(self) -> str:
        return textwrap.dedent(
            """
            You are the Bureau Score Agent in a credit underwriting swarm.
            Assess repayment texture, leverage, DPD, utilization, and credit discipline
            from CIBIL and bureau data. Be explicit about volatility vs structural stress.

            Return ONLY a JSON object matching this schema:
            {
              "stance": "approve|reject|conditional|review",
              "confidence": 0..1 float,
              "score": 0..100 int,
              "key_metrics": {"cibil": int, "dpd_30_plus": int, "utilization_pct": float},
              "flags": [{"severity": "low|medium|high", "code": str, "message": str}],
              "rationale": "2-4 sentence explanation",
              "dissent_signal": {"disagrees": bool, "strength": 0..1 float, "topic": str},
              "evidence_refs": ["bureau_data.cibil_score", ...]
            }
            """
        ).strip()

    def user_prompt(self, ctx: AgentContext, extra: dict[str, Any] | None = None) -> str:
        return f"Case and bureau context:\n{json.dumps(ctx.features, indent=2, default=str)}"

    def output_schema(self) -> type[BaseModel]:
        return SpecialistPosition

    def synthetic(self, ctx: AgentContext, seed: int) -> BaseModel:
        rng = rng_for(seed)
        bureau = ctx.features.get("bureau") or {}
        cibil = int(bureau.get("cibil_score") or 700)
        util = float(bureau.get("utilization_pct") or 45)
        dpd = int(bureau.get("dpd_30_plus_count") or 0)

        signals = [
            ("cibil", max(0.0, min(1.0, (cibil - 620) / 180.0))),
            ("util", max(0.0, min(1.0, 1 - max(0.0, util - 40) / 60.0))),
            ("dpd", 1.0 if dpd == 0 else max(0.0, 1 - dpd * 0.25)),
        ]
        stance, score, confidence = _heuristic_score(signals)
        flags: list[Flag] = []
        if util > 70:
            flags.append(Flag(severity="medium", code="high_utilization", message=f"Utilization {util}% is elevated."))
        if dpd:
            flags.append(Flag(severity="high", code="recent_dpd", message=f"{dpd} recent 30+ DPD events detected."))
        rationale = (
            f"CIBIL at {cibil} with {dpd} recent 30+ DPD events and {util}% utilization. "
            + ("Trend looks stable, supporting a positive stance." if stance == "approve"
               else "Repayment texture is mixed and warrants scrutiny.")
        )
        return SpecialistPosition(
            stance=stance,
            confidence=round(confidence + rng.uniform(-0.03, 0.03), 3),
            score=max(0, min(100, score + rng.randint(-2, 2))),
            key_metrics={"cibil": cibil, "dpd_30_plus": dpd, "utilization_pct": util},
            flags=flags,
            rationale=rationale,
            dissent_signal=DissentSignal(disagrees=dpd > 0, strength=min(1.0, dpd * 0.25), topic="repayment_volatility"),
            evidence_refs=["bureau_data.cibil_score", "bureau_data.dpd_buckets"],
        )

    def persist_output(self, ctx: AgentContext, data: dict[str, Any]) -> None:
        _persist_specialist(ctx, data)


class BankAgent(BaseAgent):
    agent_key = "bank"
    display_name = "Bank Statement Agent"

    def build_features(self, case: Case) -> dict[str, Any]:
        return {"case": case_summary(case), "bank": bank_features(case)}

    def system_prompt(self) -> str:
        return textwrap.dedent(
            """
            You are the Bank Statement Agent. Evaluate cash-flow texture, bounces,
            average monthly balance, and inflow growth. Distinguish cyclical vs
            structural volatility. Return JSON matching the SpecialistPosition schema.
            """
        ).strip()

    def user_prompt(self, ctx: AgentContext, extra: dict[str, Any] | None = None) -> str:
        return f"Bank context:\n{json.dumps(ctx.features, indent=2, default=str)}"

    def output_schema(self) -> type[BaseModel]:
        return SpecialistPosition

    def synthetic(self, ctx: AgentContext, seed: int) -> BaseModel:
        rng = rng_for(seed)
        bank = ctx.features.get("bank") or {}
        cov = float(bank.get("inflow_cov") or 0.3)
        bounces = int(bank.get("bounces_last_6mo") or 0)
        bal = int(bank.get("avg_monthly_balance") or 300000)

        signals = [
            ("cov", max(0.0, 1 - cov)),
            ("bounces", 1.0 if bounces == 0 else max(0.0, 1 - bounces * 0.18)),
            ("balance", min(1.0, bal / 500000)),
        ]
        stance, score, confidence = _heuristic_score(signals)
        flags: list[Flag] = []
        if bounces > 2:
            flags.append(Flag(severity="high", code="bounce_risk", message=f"{bounces} bounces in last 6 months."))
        if cov > 0.45:
            flags.append(Flag(severity="medium", code="inflow_volatility", message="Inflow coefficient of variation is high."))
        rationale = (
            f"Inflow CoV {cov:.2f} with {bounces} bounces and avg balance ₹{bal:,}. "
            + ("Healthy dispersion suggests stable operating cadence." if stance == "approve"
               else "Volatility and bounce signals require mitigation.")
        )
        return SpecialistPosition(
            stance=stance,
            confidence=round(confidence + rng.uniform(-0.03, 0.03), 3),
            score=max(0, min(100, score + rng.randint(-2, 2))),
            key_metrics={"inflow_cov": cov, "bounces_last_6mo": bounces, "avg_monthly_balance": bal},
            flags=flags,
            rationale=rationale,
            dissent_signal=DissentSignal(disagrees=cov > 0.4, strength=min(1.0, cov), topic="cash_flow_volatility"),
            evidence_refs=["financial_data.monthly_inflow", "financial_data.bounces_last_6mo"],
        )

    def persist_output(self, ctx: AgentContext, data: dict[str, Any]) -> None:
        _persist_specialist(ctx, data)


class FraudAgent(BaseAgent):
    agent_key = "fraud"
    display_name = "Fraud Detection Agent"

    def build_features(self, case: Case) -> dict[str, Any]:
        return {"case": case_summary(case), "fraud": fraud_features(case)}

    def system_prompt(self) -> str:
        return textwrap.dedent(
            """
            You are the Fraud Detection Agent. Evaluate KYC match, PAN/GST linkage,
            device reputation, velocity anomalies, and document authenticity. Flag any
            fraud signal and describe its severity. Return SpecialistPosition JSON.
            """
        ).strip()

    def user_prompt(self, ctx: AgentContext, extra: dict[str, Any] | None = None) -> str:
        return f"Fraud context:\n{json.dumps(ctx.features, indent=2, default=str)}"

    def output_schema(self) -> type[BaseModel]:
        return SpecialistPosition

    def synthetic(self, ctx: AgentContext, seed: int) -> BaseModel:
        rng = rng_for(seed)
        fraud = ctx.features.get("fraud") or {}
        kyc = float(fraud.get("kyc_match_pct") or 99)
        block = bool(fraud.get("device_blocklist_hit"))
        vel = int(fraud.get("velocity_anomalies") or 0)
        doc = float(fraud.get("document_authenticity_score") or 95)

        signals = [
            ("kyc", min(1.0, kyc / 100)),
            ("block", 0.2 if block else 1.0),
            ("velocity", max(0.0, 1 - vel * 0.2)),
            ("doc", min(1.0, doc / 100)),
        ]
        stance, score, confidence = _heuristic_score(signals)
        flags: list[Flag] = []
        if block:
            flags.append(Flag(severity="high", code="device_blocklist", message="Device fingerprint matched a blocklist entry."))
        if vel:
            flags.append(Flag(severity="medium", code="velocity_anomalies", message=f"{vel} velocity anomalies detected."))
        rationale = (
            f"KYC match {kyc:.1f}%, doc authenticity {doc:.1f}%. "
            + ("No fraud signals flagged; identity and linkage are clean." if stance == "approve"
               else "Anomalies present; recommend secondary verification.")
        )
        return SpecialistPosition(
            stance=stance,
            confidence=round(confidence + rng.uniform(-0.02, 0.02), 3),
            score=max(0, min(100, score)),
            key_metrics={"kyc_match_pct": kyc, "velocity_anomalies": vel, "document_authenticity": doc},
            flags=flags,
            rationale=rationale,
            dissent_signal=DissentSignal(disagrees=block or vel > 1, strength=1.0 if block else min(1.0, vel * 0.3), topic="identity_risk"),
            evidence_refs=["kyc_data.kyc_match_pct", "kyc_data.device_blocklist_hit"],
        )

    def persist_output(self, ctx: AgentContext, data: dict[str, Any]) -> None:
        _persist_specialist(ctx, data)


class IncomeAgent(BaseAgent):
    agent_key = "income"
    display_name = "Income Verification Agent"

    def build_features(self, case: Case) -> dict[str, Any]:
        return {"case": case_summary(case), "income": income_features(case)}

    def system_prompt(self) -> str:
        return textwrap.dedent(
            """
            You are the Income Verification Agent. Cross-check ITR, GST, invoices,
            and buyer concentration. Penalise concentration above ~55% and GST lapses.
            Return SpecialistPosition JSON.
            """
        ).strip()

    def user_prompt(self, ctx: AgentContext, extra: dict[str, Any] | None = None) -> str:
        return f"Income context:\n{json.dumps(ctx.features, indent=2, default=str)}"

    def output_schema(self) -> type[BaseModel]:
        return SpecialistPosition

    def synthetic(self, ctx: AgentContext, seed: int) -> BaseModel:
        rng = rng_for(seed)
        inc = ctx.features.get("income") or {}
        growth = float(inc.get("itr_yoy_growth") or 0.05)
        gst = bool(inc.get("gst_filings_regular", True))
        conc = float(inc.get("top_3_buyer_concentration_pct") or 45)

        signals = [
            ("growth", min(1.0, max(0.0, 0.5 + growth))),
            ("gst", 1.0 if gst else 0.3),
            ("conc", max(0.0, 1 - max(0.0, conc - 55) / 45.0)),
        ]
        stance, score, confidence = _heuristic_score(signals)
        flags: list[Flag] = []
        if conc > 60:
            flags.append(Flag(severity="medium", code="buyer_concentration", message=f"Top-3 buyer concentration {conc}%."))
        if not gst:
            flags.append(Flag(severity="high", code="gst_gap", message="GST filings are irregular."))
        rationale = (
            f"ITR YoY growth {growth:+.0%}, buyer concentration {conc:.0f}%. "
            + ("Income pattern matches declared figures." if stance == "approve"
               else "Concentration or GST issues warrant review.")
        )
        return SpecialistPosition(
            stance=stance,
            confidence=round(confidence + rng.uniform(-0.02, 0.02), 3),
            score=max(0, min(100, score)),
            key_metrics={"itr_yoy_growth": growth, "buyer_concentration_pct": conc, "gst_regular": gst},
            flags=flags,
            rationale=rationale,
            dissent_signal=DissentSignal(disagrees=not gst, strength=0.7 if not gst else 0.2, topic="income_veracity"),
            evidence_refs=["income_data.itr_gross_income", "income_data.top_3_buyer_concentration_pct"],
        )

    def persist_output(self, ctx: AgentContext, data: dict[str, Any]) -> None:
        _persist_specialist(ctx, data)


class PolicyAgent(BaseAgent):
    """Hybrid agent: runs deterministic rules first, LLM narrates the rationale."""

    agent_key = "policy"
    display_name = "Policy Agent"

    def build_features(self, case: Case) -> dict[str, Any]:
        policy_result = policy_evaluate(case)
        return {
            "case": case_summary(case),
            "policy": {
                "version": policy_result.version,
                "checks": [c.__dict__ for c in policy_result.checks],
                "hard_failures": [c.__dict__ for c in policy_result.hard_failures],
                "exceptions": [c.__dict__ for c in policy_result.exceptions],
                "stance": policy_result.stance,
                "required_conditions": policy_result.required_conditions,
            },
        }

    def system_prompt(self) -> str:
        return textwrap.dedent(
            """
            You are the Policy Agent. A deterministic rule engine has already decided
            the stance. Your job is ONLY to produce a clear rationale and flag list
            that matches the engine's verdict. Do NOT override the engine's stance.
            Return SpecialistPosition JSON whose 'stance' equals 'policy.stance'.
            """
        ).strip()

    def user_prompt(self, ctx: AgentContext, extra: dict[str, Any] | None = None) -> str:
        return f"Policy engine result:\n{json.dumps(ctx.features, indent=2, default=str)}"

    def output_schema(self) -> type[BaseModel]:
        return SpecialistPosition

    def synthetic(self, ctx: AgentContext, seed: int) -> BaseModel:
        rng = rng_for(seed)
        policy = ctx.features["policy"]
        stance = policy["stance"]
        score_map = {"approve": 88, "conditional": 68, "reject": 40, "review": 60}
        score = score_map.get(stance, 60) + rng.randint(-2, 2)

        flags = [
            Flag(severity=c["severity"], code=c["code"], message=c["message"])
            for c in policy["checks"] if not c["passed"]
        ]
        parts = []
        if policy["hard_failures"]:
            parts.append("Policy hard boundary breached: " + "; ".join(c["code"] for c in policy["hard_failures"]))
        if policy["exceptions"]:
            parts.append("Exception eligible: " + "; ".join(c["code"] for c in policy["exceptions"]))
        if not parts:
            parts.append("All policy checks passed within tolerance.")

        return SpecialistPosition(
            stance=stance if stance != "approve" else "approve",
            confidence=0.9 if stance != "review" else 0.7,
            score=max(0, min(100, score)),
            key_metrics={"hard_failures": len(policy["hard_failures"]), "exceptions": len(policy["exceptions"])},
            flags=flags,
            rationale=" ".join(parts),
            dissent_signal=DissentSignal(
                disagrees=stance != "approve",
                strength=0.9 if policy["hard_failures"] else (0.5 if policy["exceptions"] else 0.1),
                topic="policy_boundary",
            ),
            evidence_refs=[f"policy.{c['code']}" for c in policy["checks"]],
        )

    def persist_output(self, ctx: AgentContext, data: dict[str, Any]) -> None:
        _persist_specialist(ctx, data)


class BehaviourAgent(BaseAgent):
    agent_key = "behaviour"
    display_name = "Behavioural Agent"

    def build_features(self, case: Case) -> dict[str, Any]:
        return {"case": case_summary(case), "behaviour": behaviour_features(case)}

    def system_prompt(self) -> str:
        return textwrap.dedent(
            """
            You are the Behavioural Agent. Assess historical repayment discipline,
            tenure completion, prepayments, and rollover frequency. Return
            SpecialistPosition JSON.
            """
        ).strip()

    def user_prompt(self, ctx: AgentContext, extra: dict[str, Any] | None = None) -> str:
        return f"Behavioural context:\n{json.dumps(ctx.features, indent=2, default=str)}"

    def output_schema(self) -> type[BaseModel]:
        return SpecialistPosition

    def synthetic(self, ctx: AgentContext, seed: int) -> BaseModel:
        rng = rng_for(seed)
        bh = ctx.features.get("behaviour") or {}
        repay = float(bh.get("historical_repayment_pct") or 90)
        tenure = float(bh.get("avg_tenure_completion_pct") or 85)
        rollovers = float(bh.get("rollover_frequency") or 0.2)
        prior = int(bh.get("prior_loans_count") or 0)

        signals = [
            ("repay", min(1.0, repay / 100)),
            ("tenure", min(1.0, tenure / 100)),
            ("rollover", max(0.0, 1 - rollovers * 1.2)),
        ]
        stance, score, confidence = _heuristic_score(signals)
        flags: list[Flag] = []
        if rollovers > 0.5:
            flags.append(Flag(severity="medium", code="rollover_frequency", message="Frequent rollovers observed."))
        if repay < 85:
            flags.append(Flag(severity="high", code="low_repayment_discipline", message=f"Repayment discipline {repay:.0f}%."))
        rationale = (
            f"Prior loans: {prior}. Repayment discipline {repay:.0f}%, tenure completion {tenure:.0f}%. "
            + ("Behaviour is consistent with a reliable borrower profile." if stance == "approve"
               else "Behavioural cues suggest additional discipline is needed.")
        )
        return SpecialistPosition(
            stance=stance,
            confidence=round(confidence + rng.uniform(-0.03, 0.03), 3),
            score=max(0, min(100, score)),
            key_metrics={"repayment_pct": repay, "tenure_pct": tenure, "rollover_freq": rollovers},
            flags=flags,
            rationale=rationale,
            dissent_signal=DissentSignal(disagrees=rollovers > 0.5, strength=min(1.0, rollovers * 1.2), topic="repayment_discipline"),
            evidence_refs=["behaviour_data.historical_repayment_pct", "behaviour_data.rollover_frequency"],
        )

    def persist_output(self, ctx: AgentContext, data: dict[str, Any]) -> None:
        _persist_specialist(ctx, data)


SPECIALISTS: list[type[BaseAgent]] = [
    BureauAgent,
    BankAgent,
    FraudAgent,
    IncomeAgent,
    PolicyAgent,
    BehaviourAgent,
]
