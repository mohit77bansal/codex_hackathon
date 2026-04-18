import uuid

from django.db import models

from apps.cases.models import Case


class AgentKey(models.TextChoices):
    BUREAU = "bureau", "Bureau Score Agent"
    BANK = "bank", "Bank Statement Agent"
    FRAUD = "fraud", "Fraud Detection Agent"
    INCOME = "income", "Income Verification Agent"
    POLICY = "policy", "Policy Agent"
    BEHAVIOUR = "behaviour", "Behavioural Agent"
    LEAD = "lead", "Lead Reviewer"
    GOVERNOR = "governor", "Final Governor"


class AgentRunStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class Stance(models.TextChoices):
    APPROVE = "approve", "Approve"
    REJECT = "reject", "Reject"
    CONDITIONAL = "conditional", "Conditional"
    REVIEW = "review", "Review"


class Verdict(models.TextChoices):
    APPROVE = "approve", "Approve"
    REJECT = "reject", "Reject"
    CONDITIONAL = "conditional", "Conditional"
    ESCALATE = "escalate", "Escalate"


class AgentRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="agent_runs")
    agent_key = models.CharField(max_length=32, choices=AgentKey.choices)
    model = models.CharField(max_length=64, default="")
    prompt_hash = models.CharField(max_length=64, default="")
    seed = models.CharField(max_length=64, default="")
    status = models.CharField(max_length=16, choices=AgentRunStatus.choices, default=AgentRunStatus.PENDING)

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    latency_ms = models.IntegerField(null=True, blank=True)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    error = models.TextField(blank=True)
    raw_response = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["case", "agent_key"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.case.external_id} · {self.agent_key} · {self.status}"


class AgentPosition(models.Model):
    agent_run = models.OneToOneField(AgentRun, on_delete=models.CASCADE, related_name="position")
    stance = models.CharField(max_length=16, choices=Stance.choices)
    confidence = models.FloatField(help_text="0..1")
    score = models.IntegerField(help_text="0..100 for UI display")
    key_metrics = models.JSONField(default=dict)
    flags = models.JSONField(default=list, help_text="list of {severity, code, message}")
    rationale = models.TextField()
    dissent_signal = models.JSONField(default=dict, help_text="{disagrees, strength, topic}")
    evidence_refs = models.JSONField(default=list)

    def __str__(self) -> str:
        return f"{self.agent_run.agent_key}: {self.stance} ({self.score})"


class Debate(models.Model):
    case = models.OneToOneField(Case, on_delete=models.CASCADE, related_name="debate")
    conflict_pairs = models.JSONField(default=list, help_text="[[agent_a, agent_b, strength, topic]]")
    unique_topics = models.JSONField(default=list)
    has_conflict = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class LeadReconciliation(models.Model):
    case = models.OneToOneField(Case, on_delete=models.CASCADE, related_name="lead_reconciliation")
    agent_run = models.OneToOneField(AgentRun, on_delete=models.CASCADE, related_name="lead_reconciliation")
    reframed_question = models.TextField()
    proposed_structure = models.TextField()
    conditions = models.JSONField(default=list)
    residual_risks = models.JSONField(default=list)
    escalation_required = models.BooleanField(default=False)
    meters = models.JSONField(default=dict, help_text="uncertainty, conflict, pressure, reversibility 0..100")


class FinalDecision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="final_decisions")
    agent_run = models.OneToOneField(AgentRun, on_delete=models.CASCADE, related_name="final_decision")
    verdict = models.CharField(max_length=16, choices=Verdict.choices)
    chip_label = models.CharField(max_length=64, default="")
    rationale = models.TextField()
    confidence = models.FloatField(default=0.0)
    constraint_fit = models.CharField(max_length=32, default="")
    audit_strength = models.CharField(max_length=32, default="")
    conditions = models.JSONField(default=list)
    review_checkpoints = models.JSONField(default=list)

    superseded_by = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="overrides"
    )
    override_by_user = models.CharField(max_length=120, blank=True)
    override_note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.case.external_id} · {self.verdict}"
