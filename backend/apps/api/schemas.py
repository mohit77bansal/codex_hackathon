"""Django Ninja request/response schemas."""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from ninja import Schema


# ---------- Requests ----------


class CaseIntakeIn(Schema):
    external_id: str
    applicant_name: str
    loan_type: Optional[str] = ""
    amount_inr: Optional[int] = 0
    sector: Optional[str] = ""
    state: Optional[str] = ""
    vintage_years: Optional[float] = 0
    risk_band: Optional[str] = None

    # nested optional — synthetic generator will fill what's missing
    applicant: Optional[dict] = None
    financial: Optional[dict] = None
    bureau: Optional[dict] = None
    kyc: Optional[dict] = None
    income: Optional[dict] = None
    behaviour: Optional[dict] = None


class OverrideIn(Schema):
    verdict: str
    note: str
    user: str = "reviewer"


class SeedIn(Schema):
    count: int = 8


# ---------- Responses ----------


class CaseListItem(Schema):
    id: UUID
    external_id: str
    applicant_name: str
    loan_type: str
    amount_inr: int
    sector: str
    state: str
    vintage_years: float
    status: str
    risk_band: str
    verdict: str
    consensus_score: Optional[int]
    created_at: datetime
    updated_at: datetime


class ApplicantOut(Schema):
    legal_name: str
    gstin: str
    pan: str
    industry: str
    geography: str
    vintage_months: int


class FinancialOut(Schema):
    monthly_revenue: list[float]
    monthly_inflow: list[float]
    monthly_outflow: list[float]
    existing_emi: int
    bounces_last_6mo: int
    avg_monthly_balance: int
    dscr: float
    leverage: float


class BureauOut(Schema):
    cibil_score: int
    dpd_buckets: dict[str, int]
    enquiries_last_6mo: int
    active_loans_count: int
    utilization_pct: float
    trade_lines: list[dict[str, Any]]


class KYCOut(Schema):
    kyc_match_pct: float
    pan_gst_linked: bool
    device_blocklist_hit: bool
    velocity_anomalies: int
    document_authenticity_score: float


class IncomeOut(Schema):
    itr_gross_income: int
    itr_prior_year: int
    gst_filings_regular: bool
    top_3_buyer_concentration_pct: float
    anchor_name: str


class BehaviourOut(Schema):
    prior_loans_count: int
    historical_repayment_pct: float
    avg_tenure_completion_pct: float
    prepayments_count: int
    rollover_frequency: float


class PositionOut(Schema):
    agent_key: str
    display_name: str
    stance: str
    confidence: float
    score: int
    rationale: str
    flags: list[dict[str, Any]]
    key_metrics: dict[str, Any]
    dissent_signal: dict[str, Any]
    evidence_refs: list[str]
    latency_ms: Optional[int]


class DebateOut(Schema):
    has_conflict: bool
    conflict_pairs: list[list[Any]]
    unique_topics: list[str]


class LeadOut(Schema):
    reframed_question: str
    proposed_structure: str
    conditions: list[str]
    residual_risks: list[str]
    escalation_required: bool
    meters: dict[str, int]


class FinalDecisionOut(Schema):
    id: UUID
    verdict: str
    chip_label: str
    rationale: str
    confidence: float
    constraint_fit: str
    audit_strength: str
    conditions: list[str]
    review_checkpoints: list[str]
    created_at: datetime
    override_by_user: str
    override_note: str


class DocumentOut(Schema):
    id: str
    doc_type: str
    doc_type_display: str
    original_filename: str
    size_bytes: int
    mime_type: str
    source: str
    url: str
    uploaded_at: str
    identify: Optional[dict] = None
    extracted: Optional[dict] = None


class CaseDetailOut(Schema):
    id: UUID
    external_id: str
    applicant_name: str
    loan_type: str
    amount_inr: int
    sector: str
    state: str
    vintage_years: float
    status: str
    risk_band: str
    verdict: str
    consensus_score: Optional[int]
    created_at: datetime
    applicant: Optional[ApplicantOut] = None
    financial: Optional[FinancialOut] = None
    bureau: Optional[BureauOut] = None
    kyc: Optional[KYCOut] = None
    income: Optional[IncomeOut] = None
    behaviour: Optional[BehaviourOut] = None
    positions: list[PositionOut]
    debate: Optional[DebateOut] = None
    lead: Optional[LeadOut] = None
    final_decision: Optional[FinalDecisionOut] = None
    final_decision_history: list[FinalDecisionOut]
    documents: list[DocumentOut] = []


class AuditEntryOut(Schema):
    id: UUID
    sequence: int
    timestamp: datetime
    event_type: str
    actor: str
    title: str
    body: str
    payload: dict[str, Any]
    prev_hash: str
    row_hash: str


class AuditLedgerOut(Schema):
    case_id: UUID
    entries: list[AuditEntryOut]
    chain_valid: bool
    broken_sequences: list[int]


class RunAck(Schema):
    case_id: UUID
    status: str
    stream_url: str


class ApiEnvelope(Schema):
    success: bool
    data: Any = None
    error: Optional[str] = None
