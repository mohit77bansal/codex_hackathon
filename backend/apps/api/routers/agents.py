"""Agents roster endpoint — aggregates runtime stats across all historical runs."""
from __future__ import annotations

from typing import Any

from django.db.models import Avg, Count, Q
from ninja import Router

from apps.swarm.models import AgentKey, AgentPosition, AgentRun, AgentRunStatus

router = Router(tags=["agents"])


AGENT_META: dict[str, dict[str, str]] = {
    "bureau": {
        "name": "Bureau Score Agent",
        "short": "CIBIL & credit history",
        "role": "Reads repayment texture, leverage, DPD, utilization.",
        "model_tier": "specialist",
        "color": "indigo",
    },
    "bank": {
        "name": "Bank Statement Agent",
        "short": "Cash flow & banking behaviour",
        "role": "Evaluates inflow cadence, bounces, balance, volatility.",
        "model_tier": "specialist",
        "color": "emerald",
    },
    "fraud": {
        "name": "Fraud Detection Agent",
        "short": "KYC, device, velocity signals",
        "role": "Checks identity match, document authenticity, blocklist hits.",
        "model_tier": "specialist",
        "color": "rose",
    },
    "income": {
        "name": "Income Verification Agent",
        "short": "ITR, GST, buyer concentration",
        "role": "Cross-checks declared vs observed income and GST filings.",
        "model_tier": "specialist",
        "color": "amber",
    },
    "policy": {
        "name": "Policy Agent",
        "short": "Hybrid rule engine + LLM",
        "role": "Enforces hard boundaries; LLM narrates exceptions.",
        "model_tier": "specialist",
        "color": "sky",
    },
    "behaviour": {
        "name": "Behavioural Agent",
        "short": "Repayment & tenure patterns",
        "role": "Reads discipline, rollovers, prepayments, tenure completion.",
        "model_tier": "specialist",
        "color": "fuchsia",
    },
    "lead": {
        "name": "Lead Reviewer",
        "short": "Conflict reconciler",
        "role": "Reframes the real tradeoff; sets uncertainty / conflict meters.",
        "model_tier": "orchestrator",
        "color": "violet",
    },
    "governor": {
        "name": "Final Governor",
        "short": "Accountable decider",
        "role": "Issues verdict with confidence and audit-ready rationale.",
        "model_tier": "orchestrator",
        "color": "cyan",
    },
}


@router.get("/")
def list_agents(request) -> list[dict[str, Any]]:
    runs = (
        AgentRun.objects.values("agent_key")
        .annotate(
            run_count=Count("id"),
            completed=Count("id", filter=Q(status=AgentRunStatus.COMPLETED)),
            failed=Count("id", filter=Q(status=AgentRunStatus.FAILED)),
            avg_latency_ms=Avg("latency_ms"),
        )
    )
    runs_by_key = {r["agent_key"]: r for r in runs}

    positions = (
        AgentPosition.objects.values("agent_run__agent_key")
        .annotate(
            avg_score=Avg("score"),
            avg_confidence=Avg("confidence"),
            approve=Count("id", filter=Q(stance="approve")),
            reject=Count("id", filter=Q(stance="reject")),
            conditional=Count("id", filter=Q(stance="conditional")),
            review=Count("id", filter=Q(stance="review")),
        )
    )
    pos_by_key = {p["agent_run__agent_key"]: p for p in positions}

    out: list[dict[str, Any]] = []
    for key in AgentKey.values:
        meta = AGENT_META.get(key, {"name": key, "short": "", "role": "", "model_tier": "specialist", "color": "slate"})
        r = runs_by_key.get(key, {})
        p = pos_by_key.get(key, {})
        out.append({
            "key": key,
            "name": meta["name"],
            "short": meta["short"],
            "role": meta["role"],
            "model_tier": meta["model_tier"],
            "color": meta["color"],
            "run_count": r.get("run_count", 0),
            "completed": r.get("completed", 0),
            "failed": r.get("failed", 0),
            "avg_latency_ms": round(r.get("avg_latency_ms") or 0, 0),
            "avg_score": round(p.get("avg_score") or 0, 1),
            "avg_confidence": round(p.get("avg_confidence") or 0, 3),
            "stance_mix": {
                "approve": p.get("approve", 0),
                "reject": p.get("reject", 0),
                "conditional": p.get("conditional", 0),
                "review": p.get("review", 0),
            },
        })
    return out
