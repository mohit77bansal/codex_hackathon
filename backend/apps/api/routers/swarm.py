"""Swarm run / override endpoints."""
from __future__ import annotations

from uuid import UUID

from django.conf import settings
from django.shortcuts import get_object_or_404
from ninja import Router

from apps.api.schemas import FinalDecisionOut, OverrideIn, RunAck
from apps.audit.models import AuditEventType, AuditLogService
from apps.cases.models import Case
from apps.swarm.models import FinalDecision

router = Router(tags=["swarm"])


@router.post("/{case_id}/run/", response=RunAck)
def run_case(request, case_id: UUID):
    case = get_object_or_404(Case, id=case_id)

    # Eager mode (v1 default) runs inline for immediate feedback.
    if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", True):
        from apps.orchestration.runner import run_swarm

        run_swarm(str(case.id))
    else:
        from apps.orchestration.tasks import run_case_swarm

        run_case_swarm.delay(str(case.id))

    case.refresh_from_db()
    return {
        "case_id": case.id,
        "status": case.status,
        "stream_url": f"/events/?channel=case-{case.id}",
    }


@router.post("/{case_id}/override/", response=FinalDecisionOut)
def override_decision(request, case_id: UUID, payload: OverrideIn):
    case = get_object_or_404(Case, id=case_id)
    current = case.final_decisions.order_by("-created_at").first()
    if not current:
        return {"error": "no existing decision"}  # type: ignore[return-value]

    from apps.swarm.models import AgentRun, AgentRunStatus

    shadow_run = AgentRun.objects.create(
        case=case,
        agent_key="governor",
        model="override:manual",
        prompt_hash="",
        seed="",
        status=AgentRunStatus.COMPLETED,
    )
    new_decision = FinalDecision.objects.create(
        case=case,
        agent_run=shadow_run,
        verdict=payload.verdict,
        chip_label="Reviewer override",
        rationale=payload.note,
        confidence=current.confidence,
        constraint_fit=current.constraint_fit,
        audit_strength="very strong",
        conditions=current.conditions,
        review_checkpoints=current.review_checkpoints,
        override_by_user=payload.user,
        override_note=payload.note,
    )
    current.superseded_by = new_decision
    current.save(update_fields=["superseded_by"])

    case.status = "overridden"
    case.verdict = payload.verdict
    case.save(update_fields=["status", "verdict", "updated_at"])

    AuditLogService.append(
        case=case,
        event_type=AuditEventType.DECISION_OVERRIDE,
        actor=f"user:{payload.user}",
        title=f"Override → {payload.verdict}",
        body=payload.note[:400],
        payload={"previous_decision": str(current.id), "new_decision": str(new_decision.id)},
    )

    return {
        "id": new_decision.id,
        "verdict": new_decision.verdict,
        "chip_label": new_decision.chip_label,
        "rationale": new_decision.rationale,
        "confidence": new_decision.confidence,
        "constraint_fit": new_decision.constraint_fit,
        "audit_strength": new_decision.audit_strength,
        "conditions": new_decision.conditions,
        "review_checkpoints": new_decision.review_checkpoints,
        "created_at": new_decision.created_at,
        "override_by_user": new_decision.override_by_user,
        "override_note": new_decision.override_note,
    }
