"""Sync swarm runner.

For Phase 1 we run specialists in a threadpool for real concurrency, then invoke
Lead + Governor sequentially. Celery tasks in tasks.py wrap this runner so it can
also execute async.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from django.utils import timezone

from apps.agents.orchestrators import FinalGovernor, LeadReviewer, compute_debate
from apps.agents.specialists import SPECIALISTS
from apps.audit.models import AuditEventType, AuditLogService
from apps.cases.models import Case, CaseStatus
from apps.orchestration.events import publish

logger = logging.getLogger(__name__)


def _run_specialist(agent_cls, case: Case) -> dict[str, Any]:
    agent = agent_cls()
    publish(str(case.id), "agent.started", {"agent_key": agent.agent_key, "display_name": agent.display_name})
    agent_run, data = agent.run(case)
    publish(
        str(case.id),
        "agent.completed",
        {
            "agent_key": agent.agent_key,
            "display_name": agent.display_name,
            "stance": data.get("stance"),
            "score": data.get("score"),
            "confidence": data.get("confidence"),
            "rationale": data.get("rationale"),
            "flags": data.get("flags", []),
            "key_metrics": data.get("key_metrics", {}),
            "latency_ms": agent_run.latency_ms,
        },
    )
    return {"agent_key": agent.agent_key, "data": data}


def run_swarm(case_id: str) -> dict[str, Any]:
    """Run the full 6-specialist swarm + lead + governor for a single case."""
    case = Case.objects.get(id=case_id)
    case.status = CaseStatus.RUNNING
    case.save(update_fields=["status", "updated_at"])

    AuditLogService.append(
        case=case,
        event_type=AuditEventType.SWARM_STARTED,
        actor="system",
        title="Swarm started",
        body=f"Running {len(SPECIALISTS)} specialists plus Lead & Governor.",
    )
    publish(str(case.id), "swarm.started", {"case_id": str(case.id)})

    from django.conf import settings as django_settings
    use_threadpool = django_settings.DATABASES["default"]["ENGINE"] != "django.db.backends.sqlite3"
    specialist_results: list[dict[str, Any]] = []
    if use_threadpool:
        with ThreadPoolExecutor(max_workers=len(SPECIALISTS)) as pool:
            futures = [pool.submit(_run_specialist, cls, case) for cls in SPECIALISTS]
            for fut in as_completed(futures):
                try:
                    specialist_results.append(fut.result())
                except Exception as exc:  # noqa: BLE001
                    logger.exception("Specialist failure: %s", exc)
    else:
        for cls in SPECIALISTS:
            try:
                specialist_results.append(_run_specialist(cls, case))
            except Exception as exc:  # noqa: BLE001
                logger.exception("Specialist failure: %s", exc)

    # Debate
    case.refresh_from_db()
    debate = compute_debate(case)
    if debate.has_conflict:
        AuditLogService.append(
            case=case,
            event_type=AuditEventType.DEBATE_DETECTED,
            actor="system",
            title="Debate detected",
            body=f"{len(debate.conflict_pairs)} conflict pair(s) across topics {', '.join(debate.unique_topics) or 'n/a'}",
            payload={"conflict_pairs": debate.conflict_pairs, "topics": debate.unique_topics},
        )
        publish(
            str(case.id),
            "debate.detected",
            {"conflict_pairs": debate.conflict_pairs, "topics": debate.unique_topics},
        )

    case.status = CaseStatus.DEBATING
    case.save(update_fields=["status", "updated_at"])

    # Lead
    publish(str(case.id), "agent.started", {"agent_key": "lead", "display_name": "Lead Reviewer"})
    lead = LeadReviewer()
    lead_run, lead_data = lead.run(case)
    AuditLogService.append(
        case=case,
        event_type=AuditEventType.LEAD_INTERVENTION,
        actor="agent:lead",
        title="Lead reframed the tradeoff",
        body=lead_data["reframed_question"][:280],
        payload={"lead": lead_data},
    )
    publish(
        str(case.id),
        "lead.reconciled",
        {
            "reframed_question": lead_data["reframed_question"],
            "proposed_structure": lead_data["proposed_structure"],
            "conditions": lead_data["conditions"],
            "residual_risks": lead_data["residual_risks"],
            "meters": lead_data["meters"],
            "escalation_required": lead_data["escalation_required"],
            "latency_ms": lead_run.latency_ms,
        },
    )

    # Governor
    publish(str(case.id), "agent.started", {"agent_key": "governor", "display_name": "Final Governor"})
    gov = FinalGovernor()
    gov_run, gov_data = gov.run(case)
    AuditLogService.append(
        case=case,
        event_type=AuditEventType.DECISION_FINAL,
        actor="agent:governor",
        title=f"Decision: {gov_data['verdict']}",
        body=gov_data["rationale"][:400],
        payload={"decision": gov_data},
    )
    publish(
        str(case.id),
        "decision.final",
        {
            "verdict": gov_data["verdict"],
            "chip_label": gov_data.get("chip_label"),
            "rationale": gov_data["rationale"],
            "confidence": gov_data["confidence"],
            "constraint_fit": gov_data.get("constraint_fit"),
            "audit_strength": gov_data.get("audit_strength"),
            "conditions": gov_data.get("conditions", []),
            "review_checkpoints": gov_data.get("review_checkpoints", []),
            "latency_ms": gov_run.latency_ms,
        },
    )

    # Persist case verdict and consensus
    from apps.swarm.models import AgentPosition

    scores = [p.score for p in AgentPosition.objects.filter(agent_run__case=case)]
    consensus = int(round(sum(scores) / len(scores))) if scores else 0
    case.status = CaseStatus.DECIDED
    case.verdict = gov_data["verdict"]
    case.consensus_score = consensus
    case.save(update_fields=["status", "verdict", "consensus_score", "updated_at"])

    AuditLogService.append(
        case=case,
        event_type=AuditEventType.SWARM_COMPLETED,
        actor="system",
        title="Swarm complete",
        body=f"Consensus score {consensus} · verdict {gov_data['verdict']}",
    )
    publish(
        str(case.id),
        "swarm.completed",
        {
            "verdict": gov_data["verdict"],
            "consensus_score": consensus,
            "completed_at": timezone.now().isoformat(),
        },
    )

    return {
        "case_id": str(case.id),
        "verdict": gov_data["verdict"],
        "consensus_score": consensus,
        "specialists": specialist_results,
        "lead": lead_data,
        "governor": gov_data,
    }
