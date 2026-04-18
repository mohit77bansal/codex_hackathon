"""Celery tasks wrapping the swarm runner."""
from __future__ import annotations

import logging

from celery import shared_task

from apps.audit.models import AuditEventType, AuditLogService
from apps.cases.models import Case, CaseStatus
from apps.orchestration.events import publish
from apps.orchestration.runner import run_swarm

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0)
def run_case_swarm(self, case_id: str) -> dict:
    try:
        return run_swarm(case_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Swarm failed for case %s", case_id)
        try:
            case = Case.objects.get(id=case_id)
            case.status = CaseStatus.FAILED
            case.save(update_fields=["status", "updated_at"])
            AuditLogService.append(
                case=case,
                event_type=AuditEventType.SWARM_FAILED,
                actor="system",
                title="Swarm failed",
                body=str(exc),
            )
            publish(str(case.id), "swarm.failed", {"error": str(exc)})
        except Case.DoesNotExist:
            pass
        raise
