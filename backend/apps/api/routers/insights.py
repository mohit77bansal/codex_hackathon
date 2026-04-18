"""Portfolio, escalations, and settings endpoints."""
from __future__ import annotations

from collections import Counter
from typing import Any

from django.conf import settings
from django.db.models import Count, Q, Sum
from ninja import Router

from apps.audit.models import AuditLogService
from apps.cases.models import Case, CaseStatus
from apps.swarm.models import AgentRun, AgentRunStatus, FinalDecision, LeadReconciliation

router = Router(tags=["insights"])


def _hhi(counts: dict[str, int | float]) -> float:
    total = sum(counts.values()) or 1
    return round(sum(((v / total) * 100) ** 2 for v in counts.values()), 1)


@router.get("/portfolio/")
def portfolio(request) -> dict[str, Any]:
    booked = Case.objects.filter(verdict__in=["approve", "conditional"])
    booked_list = list(booked)

    total_exposure = sum(c.amount_inr for c in booked_list)
    industry_mix = Counter(c.sector for c in booked_list)
    geography_mix = Counter(c.state for c in booked_list)
    verdict_mix = Counter(
        c.verdict or "pending" for c in Case.objects.exclude(verdict="")
    )
    loan_type_mix = Counter(c.loan_type for c in booked_list)

    industry_exposure = {}
    for sector, _ in industry_mix.items():
        amt = sum(c.amount_inr for c in booked_list if c.sector == sector)
        industry_exposure[sector] = amt

    # Top concentrations
    top_industries = sorted(industry_exposure.items(), key=lambda x: -x[1])[:5]
    top_geographies = sorted(
        Counter({c.state: c.amount_inr for c in booked_list if False}).items(),
        key=lambda x: -x[1],
    )
    geo_exposure = Counter()
    for c in booked_list:
        geo_exposure[c.state] += c.amount_inr
    top_geographies = sorted(geo_exposure.items(), key=lambda x: -x[1])[:5]

    approved_amount = sum(c.amount_inr for c in booked_list if c.verdict == "approve")
    conditional_amount = sum(c.amount_inr for c in booked_list if c.verdict == "conditional")
    rejected_count = Case.objects.filter(verdict="reject").count()

    # Portfolio HHI on industry exposure
    hhi_industry = _hhi(industry_exposure)
    hhi_geography = _hhi(dict(geo_exposure))

    # Avg consensus score of booked cases
    avg_consensus = 0
    if booked_list:
        scored = [c.consensus_score for c in booked_list if c.consensus_score is not None]
        if scored:
            avg_consensus = round(sum(scored) / len(scored), 1)

    return {
        "total_cases": Case.objects.count(),
        "booked_cases": len(booked_list),
        "rejected_cases": rejected_count,
        "total_exposure_inr": total_exposure,
        "approved_exposure_inr": approved_amount,
        "conditional_exposure_inr": conditional_amount,
        "avg_consensus_score": avg_consensus,
        "industry_mix": [
            {"label": k, "count": v, "exposure": industry_exposure.get(k, 0)} for k, v in industry_mix.most_common()
        ],
        "geography_mix": [
            {"label": k, "count": v, "exposure": geo_exposure.get(k, 0)} for k, v in geography_mix.most_common()
        ],
        "loan_type_mix": [{"label": k, "count": v} for k, v in loan_type_mix.most_common()],
        "verdict_mix": [{"label": k, "count": v} for k, v in verdict_mix.most_common()],
        "top_industries": [{"label": k, "exposure": v} for k, v in top_industries],
        "top_geographies": [{"label": k, "exposure": v} for k, v in top_geographies],
        "hhi": {"industry": hhi_industry, "geography": hhi_geography},
    }


@router.get("/escalations/")
def escalations(request) -> list[dict[str, Any]]:
    """Cases that need human attention."""
    items: list[dict[str, Any]] = []

    # 1) Failed swarms
    for c in Case.objects.filter(status=CaseStatus.FAILED):
        items.append({
            "case_id": str(c.id),
            "external_id": c.external_id,
            "applicant_name": c.applicant_name,
            "amount_inr": c.amount_inr,
            "reason": "Swarm failed",
            "severity": "high",
            "created_at": c.updated_at.isoformat(),
        })

    # 2) Cases flagged by lead
    for lead in LeadReconciliation.objects.filter(escalation_required=True).select_related("case"):
        items.append({
            "case_id": str(lead.case.id),
            "external_id": lead.case.external_id,
            "applicant_name": lead.case.applicant_name,
            "amount_inr": lead.case.amount_inr,
            "reason": f"Lead flagged: {lead.reframed_question[:140]}",
            "severity": "medium",
            "created_at": lead.case.updated_at.isoformat(),
        })

    # 3) Governor rejects
    for dec in FinalDecision.objects.filter(verdict="reject", superseded_by__isnull=True).select_related("case"):
        items.append({
            "case_id": str(dec.case.id),
            "external_id": dec.case.external_id,
            "applicant_name": dec.case.applicant_name,
            "amount_inr": dec.case.amount_inr,
            "reason": f"Rejected: {dec.chip_label or dec.rationale[:120]}",
            "severity": "medium",
            "created_at": dec.created_at.isoformat(),
        })

    # 4) Governor escalates explicitly
    for dec in FinalDecision.objects.filter(verdict="escalate", superseded_by__isnull=True).select_related("case"):
        items.append({
            "case_id": str(dec.case.id),
            "external_id": dec.case.external_id,
            "applicant_name": dec.case.applicant_name,
            "amount_inr": dec.case.amount_inr,
            "reason": "Governor escalated to senior review",
            "severity": "high",
            "created_at": dec.created_at.isoformat(),
        })

    # 5) Overridden decisions
    for dec in FinalDecision.objects.exclude(override_by_user="").select_related("case"):
        items.append({
            "case_id": str(dec.case.id),
            "external_id": dec.case.external_id,
            "applicant_name": dec.case.applicant_name,
            "amount_inr": dec.case.amount_inr,
            "reason": f"Overridden by {dec.override_by_user} to {dec.verdict}",
            "severity": "high",
            "created_at": dec.created_at.isoformat(),
        })

    # Dedupe by case_id keeping highest severity
    sev_rank = {"high": 3, "medium": 2, "low": 1}
    best: dict[str, dict[str, Any]] = {}
    for item in items:
        k = item["case_id"]
        if k not in best or sev_rank[item["severity"]] > sev_rank[best[k]["severity"]]:
            best[k] = item
    return sorted(best.values(), key=lambda x: (-sev_rank[x["severity"]], x["created_at"]), reverse=False)


@router.get("/settings/")
def runtime_settings(request) -> dict[str, Any]:
    policy_path = settings.SWARM_POLICY_FILE
    policy_text = ""
    try:
        with open(policy_path) as fh:
            policy_text = fh.read()
    except OSError:
        pass

    agent_run_count = AgentRun.objects.count()
    failed_runs = AgentRun.objects.filter(status=AgentRunStatus.FAILED).count()

    # Check chain health across all cases
    total_cases = Case.objects.count()
    broken_cases = 0
    for c in Case.objects.all():
        ok, _ = AuditLogService.verify_chain(c)
        if not ok:
            broken_cases += 1

    return {
        "llm": {
            "synthetic_mode": settings.SWARM_SYNTHETIC_MODE,
            "has_api_key": bool(settings.OPENAI_API_KEY),
            "specialist_model": settings.OPENAI_MODEL_SPECIALIST,
            "orchestrator_model": settings.OPENAI_MODEL_ORCHESTRATOR,
        },
        "celery": {
            "eager_mode": settings.CELERY_TASK_ALWAYS_EAGER,
            "broker": settings.CELERY_BROKER_URL,
        },
        "policy": {
            "path": policy_path,
            "content": policy_text,
        },
        "database": {
            "engine": settings.DATABASES["default"]["ENGINE"],
        },
        "health": {
            "total_cases": total_cases,
            "agent_runs": agent_run_count,
            "failed_runs": failed_runs,
            "audit_chain_breaks": broken_cases,
        },
    }
