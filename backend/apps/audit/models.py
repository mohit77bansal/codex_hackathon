import hashlib
import json
import uuid
from typing import Any

from django.db import models, transaction
from django.utils import timezone

from apps.cases.models import Case


class AuditEventType(models.TextChoices):
    CASE_CREATED = "case.created", "Case created"
    SWARM_STARTED = "swarm.started", "Swarm started"
    AGENT_STARTED = "agent.started", "Agent started"
    AGENT_COMPLETED = "agent.completed", "Agent completed"
    AGENT_FAILED = "agent.failed", "Agent failed"
    POSITION_RECORDED = "position.recorded", "Position recorded"
    DEBATE_DETECTED = "debate.detected", "Debate detected"
    LEAD_INTERVENTION = "lead.intervention", "Lead intervention"
    DECISION_FINAL = "decision.final", "Final decision"
    DECISION_OVERRIDE = "decision.override", "Decision override"
    SWARM_COMPLETED = "swarm.completed", "Swarm completed"
    SWARM_FAILED = "swarm.failed", "Swarm failed"


class AuditLogEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(Case, on_delete=models.PROTECT, related_name="audit_entries")
    sequence = models.BigIntegerField(help_text="Per-case monotonic sequence")
    timestamp = models.DateTimeField(default=timezone.now)
    event_type = models.CharField(max_length=48, choices=AuditEventType.choices)
    actor = models.CharField(max_length=120, help_text="agent:bureau | user:mohit | system")
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)

    prev_hash = models.CharField(max_length=64, default="")
    row_hash = models.CharField(max_length=64, default="")

    class Meta:
        ordering = ["case", "sequence"]
        unique_together = [("case", "sequence")]
        indexes = [
            models.Index(fields=["case", "sequence"]),
            models.Index(fields=["event_type"]),
        ]

    def compute_hash(self) -> str:
        payload_canonical = json.dumps(
            {
                "case": str(self.case_id),
                "sequence": self.sequence,
                "timestamp": self.timestamp.isoformat(),
                "event_type": self.event_type,
                "actor": self.actor,
                "title": self.title,
                "body": self.body,
                "payload": self.payload,
                "prev_hash": self.prev_hash,
            },
            sort_keys=True,
            default=str,
        )
        return hashlib.sha256(payload_canonical.encode("utf-8")).hexdigest()


class AuditLogService:
    """Append-only service. The ONLY write path for audit entries."""

    @staticmethod
    @transaction.atomic
    def append(
        *,
        case: Case,
        event_type: str,
        actor: str,
        title: str,
        body: str = "",
        payload: dict[str, Any] | None = None,
    ) -> AuditLogEntry:
        last = (
            AuditLogEntry.objects.select_for_update()
            .filter(case=case)
            .order_by("-sequence")
            .first()
        )
        sequence = (last.sequence + 1) if last else 1
        prev_hash = last.row_hash if last else ""

        entry = AuditLogEntry(
            case=case,
            sequence=sequence,
            event_type=event_type,
            actor=actor,
            title=title,
            body=body,
            payload=payload or {},
            prev_hash=prev_hash,
        )
        entry.row_hash = entry.compute_hash()
        entry.save()
        return entry

    @staticmethod
    def verify_chain(case: Case) -> tuple[bool, list[int]]:
        """Re-hash every entry in order and flag breaks."""
        prev = ""
        broken: list[int] = []
        for entry in AuditLogEntry.objects.filter(case=case).order_by("sequence"):
            expected_prev = prev
            if entry.prev_hash != expected_prev:
                broken.append(entry.sequence)
            recomputed = entry.compute_hash()
            if recomputed != entry.row_hash:
                broken.append(entry.sequence)
            prev = entry.row_hash
        return (len(broken) == 0, broken)
