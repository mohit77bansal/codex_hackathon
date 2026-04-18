"""Pydantic schemas used for structured LLM outputs across all agents."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


Severity = Literal["low", "medium", "high"]
Stance = Literal["approve", "reject", "conditional", "review"]
Verdict = Literal["approve", "reject", "conditional", "escalate"]


class Flag(BaseModel):
    severity: Severity
    code: str
    message: str


class DissentSignal(BaseModel):
    disagrees: bool = False
    strength: float = Field(ge=0.0, le=1.0, default=0.0)
    topic: str = ""


class SpecialistPosition(BaseModel):
    """Schema every specialist agent must return."""

    stance: Stance
    confidence: float = Field(ge=0.0, le=1.0)
    score: int = Field(ge=0, le=100, description="display score 0-100")
    key_metrics: dict[str, float | int | str] = Field(default_factory=dict)
    flags: list[Flag] = Field(default_factory=list)
    rationale: str = Field(min_length=10, max_length=1200)
    dissent_signal: DissentSignal = Field(default_factory=DissentSignal)
    evidence_refs: list[str] = Field(default_factory=list)


class ConflictPair(BaseModel):
    agent_a: str
    agent_b: str
    strength: float = Field(ge=0.0, le=1.0)
    topic: str


class LeadReconciliationOutput(BaseModel):
    reframed_question: str
    proposed_structure: str
    conditions: list[str] = Field(default_factory=list)
    residual_risks: list[str] = Field(default_factory=list)
    escalation_required: bool = False
    meters: dict[str, int] = Field(
        default_factory=lambda: {"uncertainty": 50, "conflict": 50, "pressure": 50, "reversibility": 50},
    )


class FinalDecisionOutput(BaseModel):
    verdict: Verdict
    chip_label: str
    rationale: str
    confidence: float = Field(ge=0.0, le=1.0)
    constraint_fit: Literal["very high", "high", "medium", "low"]
    audit_strength: Literal["very strong", "strong", "medium", "weak"]
    conditions: list[str] = Field(default_factory=list)
    review_checkpoints: list[str] = Field(default_factory=list)
