"""Case CRUD + detail endpoints."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db import transaction
from django.shortcuts import get_object_or_404
from ninja import Router

from apps.api.schemas import (
    ApiEnvelope,
    CaseDetailOut,
    CaseIntakeIn,
    CaseListItem,
    SeedIn,
)
from apps.audit.models import AuditEventType, AuditLogService
from apps.cases.models import (
    Applicant,
    BehaviourData,
    BureauData,
    Case,
    CaseStatus,
    FinancialData,
    IncomeData,
    KYCData,
    RiskBand,
)

router = Router(tags=["cases"])


def _serialize_case(case: Case) -> dict[str, Any]:
    applicant = getattr(case, "applicant", None)
    financial = getattr(case, "financial_data", None)
    bureau = getattr(case, "bureau_data", None)
    kyc = getattr(case, "kyc_data", None)
    income = getattr(case, "income_data", None)
    behaviour = getattr(case, "behaviour_data", None)
    debate = getattr(case, "debate", None)
    lead = getattr(case, "lead_reconciliation", None)

    from apps.swarm.models import AgentPosition, FinalDecision

    positions = (
        AgentPosition.objects.filter(agent_run__case=case)
        .select_related("agent_run")
        .order_by("agent_run__created_at")
    )
    position_payload = [
        {
            "agent_key": p.agent_run.agent_key,
            "display_name": p.agent_run.get_agent_key_display(),
            "stance": p.stance,
            "confidence": p.confidence,
            "score": p.score,
            "rationale": p.rationale,
            "flags": p.flags or [],
            "key_metrics": p.key_metrics or {},
            "dissent_signal": p.dissent_signal or {},
            "evidence_refs": p.evidence_refs or [],
            "latency_ms": p.agent_run.latency_ms,
        }
        for p in positions
    ]

    decisions = case.final_decisions.order_by("-created_at")
    final = decisions.first()
    decision_payload = None
    if final:
        decision_payload = {
            "id": final.id,
            "verdict": final.verdict,
            "chip_label": final.chip_label,
            "rationale": final.rationale,
            "confidence": final.confidence,
            "constraint_fit": final.constraint_fit,
            "audit_strength": final.audit_strength,
            "conditions": final.conditions or [],
            "review_checkpoints": final.review_checkpoints or [],
            "created_at": final.created_at,
            "override_by_user": final.override_by_user or "",
            "override_note": final.override_note or "",
        }
    documents_payload = [
        {
            "id": str(d.id),
            "doc_type": d.doc_type,
            "doc_type_display": d.get_doc_type_display(),
            "original_filename": d.original_filename,
            "size_bytes": d.size_bytes,
            "mime_type": d.mime_type,
            "source": d.source,
            "url": d.file.url if d.file else "",
            "uploaded_at": d.uploaded_at.isoformat(),
            "identify": {
                "confidence": (d.extracted_meta or {}).get("identify_confidence", 0.0),
                "source": (d.extracted_meta or {}).get("identify_source", ""),
                "evidence": (d.extracted_meta or {}).get("identify_evidence", ""),
            },
            "extracted": (d.extracted_meta or {}).get("extracted", {}),
        }
        for d in case.documents.all()
    ]
    history_payload = [
        {
            "id": d.id,
            "verdict": d.verdict,
            "chip_label": d.chip_label,
            "rationale": d.rationale,
            "confidence": d.confidence,
            "constraint_fit": d.constraint_fit,
            "audit_strength": d.audit_strength,
            "conditions": d.conditions or [],
            "review_checkpoints": d.review_checkpoints or [],
            "created_at": d.created_at,
            "override_by_user": d.override_by_user or "",
            "override_note": d.override_note or "",
        }
        for d in decisions
    ]

    return {
        "id": case.id,
        "external_id": case.external_id,
        "applicant_name": case.applicant_name,
        "loan_type": case.loan_type,
        "amount_inr": case.amount_inr,
        "sector": case.sector,
        "state": case.state,
        "vintage_years": float(case.vintage_years),
        "status": case.status,
        "risk_band": case.risk_band,
        "verdict": case.verdict,
        "consensus_score": case.consensus_score,
        "created_at": case.created_at,
        "applicant": {
            "legal_name": applicant.legal_name,
            "gstin": applicant.gstin,
            "pan": applicant.pan,
            "industry": applicant.industry,
            "geography": applicant.geography,
            "vintage_months": applicant.vintage_months,
        } if applicant else None,
        "financial": {
            "monthly_revenue": financial.monthly_revenue,
            "monthly_inflow": financial.monthly_inflow,
            "monthly_outflow": financial.monthly_outflow,
            "existing_emi": financial.existing_emi,
            "bounces_last_6mo": financial.bounces_last_6mo,
            "avg_monthly_balance": financial.avg_monthly_balance,
            "dscr": financial.dscr,
            "leverage": financial.leverage,
        } if financial else None,
        "bureau": {
            "cibil_score": bureau.cibil_score,
            "dpd_buckets": bureau.dpd_buckets,
            "enquiries_last_6mo": bureau.enquiries_last_6mo,
            "active_loans_count": bureau.active_loans_count,
            "utilization_pct": bureau.utilization_pct,
            "trade_lines": bureau.trade_lines or [],
        } if bureau else None,
        "kyc": {
            "kyc_match_pct": kyc.kyc_match_pct,
            "pan_gst_linked": kyc.pan_gst_linked,
            "device_blocklist_hit": kyc.device_blocklist_hit,
            "velocity_anomalies": kyc.velocity_anomalies,
            "document_authenticity_score": kyc.document_authenticity_score,
        } if kyc else None,
        "income": {
            "itr_gross_income": income.itr_gross_income,
            "itr_prior_year": income.itr_prior_year,
            "gst_filings_regular": income.gst_filings_regular,
            "top_3_buyer_concentration_pct": income.top_3_buyer_concentration_pct,
            "anchor_name": income.anchor_name,
        } if income else None,
        "behaviour": {
            "prior_loans_count": behaviour.prior_loans_count,
            "historical_repayment_pct": behaviour.historical_repayment_pct,
            "avg_tenure_completion_pct": behaviour.avg_tenure_completion_pct,
            "prepayments_count": behaviour.prepayments_count,
            "rollover_frequency": behaviour.rollover_frequency,
        } if behaviour else None,
        "positions": position_payload,
        "debate": {
            "has_conflict": debate.has_conflict,
            "conflict_pairs": debate.conflict_pairs or [],
            "unique_topics": debate.unique_topics or [],
        } if debate else None,
        "lead": {
            "reframed_question": lead.reframed_question,
            "proposed_structure": lead.proposed_structure,
            "conditions": lead.conditions or [],
            "residual_risks": lead.residual_risks or [],
            "escalation_required": lead.escalation_required,
            "meters": lead.meters or {},
        } if lead else None,
        "final_decision": decision_payload,
        "final_decision_history": history_payload,
        "documents": documents_payload,
    }


@router.get("/", response=list[CaseListItem])
def list_cases(request, status: str | None = None, limit: int = 50):
    qs = Case.objects.all()
    if status:
        qs = qs.filter(status=status)
    return [
        {
            "id": c.id,
            "external_id": c.external_id,
            "applicant_name": c.applicant_name,
            "loan_type": c.loan_type,
            "amount_inr": c.amount_inr,
            "sector": c.sector,
            "state": c.state,
            "vintage_years": float(c.vintage_years),
            "status": c.status,
            "risk_band": c.risk_band,
            "verdict": c.verdict,
            "consensus_score": c.consensus_score,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
        }
        for c in qs[:limit]
    ]


@router.get("/{case_id}/", response=CaseDetailOut)
def get_case(request, case_id: UUID):
    case = get_object_or_404(Case, id=case_id)
    return _serialize_case(case)


@router.post("/", response=CaseDetailOut)
def create_case(request, payload: CaseIntakeIn):
    return _create_case_inner(payload)


@transaction.atomic
def _create_case_inner(payload):
    applicant_data = payload.applicant or {}
    financial_data = payload.financial or {}
    bureau_data = payload.bureau or {}
    kyc_data = payload.kyc or {}
    income_data = payload.income or {}
    behaviour_data = payload.behaviour or {}

    case = Case.objects.create(
        external_id=payload.external_id,
        applicant_name=payload.applicant_name,
        loan_type=payload.loan_type or "working_capital",
        amount_inr=payload.amount_inr or 0,
        sector=payload.sector or "",
        state=payload.state or "",
        vintage_years=payload.vintage_years or 0,
        risk_band=payload.risk_band or RiskBand.MEDIUM,
        status=CaseStatus.INTAKE,
    )

    # Create empty related rows — document extractors populate them as the
    # user attaches CIBIL / bank statement / GST etc. Specialists treat empty
    # fields as "insufficient evidence" instead of hallucinating.
    Applicant.objects.create(
        case=case,
        legal_name=applicant_data.get("legal_name", payload.applicant_name),
        gstin=applicant_data.get("gstin", ""),
        pan=applicant_data.get("pan", ""),
        industry=applicant_data.get("industry", payload.sector or ""),
        geography=applicant_data.get("geography", payload.state or ""),
        vintage_months=applicant_data.get("vintage_months", int((payload.vintage_years or 0) * 12)),
        directors=applicant_data.get("directors", []),
    )
    FinancialData.objects.create(case=case, **financial_data)
    BureauData.objects.create(case=case, **bureau_data)
    KYCData.objects.create(case=case, **kyc_data)
    IncomeData.objects.create(case=case, **income_data)
    BehaviourData.objects.create(case=case, **behaviour_data)

    AuditLogService.append(
        case=case,
        event_type=AuditEventType.CASE_CREATED,
        actor="user:intake",
        title="Case created",
        body=f"{payload.applicant_name} · {payload.loan_type} · ₹{payload.amount_inr:,}",
        payload={"external_id": payload.external_id, "amount_inr": payload.amount_inr},
    )

    return _serialize_case(case)


@router.post("/seed", response=list[CaseListItem])
def seed_cases(request, payload: SeedIn):
    from apps.cases.management.commands.seed_cases import generate

    created = generate(payload.count)
    return [
        {
            "id": c.id,
            "external_id": c.external_id,
            "applicant_name": c.applicant_name,
            "loan_type": c.loan_type,
            "amount_inr": c.amount_inr,
            "sector": c.sector,
            "state": c.state,
            "vintage_years": float(c.vintage_years),
            "status": c.status,
            "risk_band": c.risk_band,
            "verdict": c.verdict,
            "consensus_score": c.consensus_score,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
        }
        for c in created
    ]


@router.delete("/{case_id}/")
def delete_case(request, case_id: UUID):
    case = get_object_or_404(Case, id=case_id)
    case.audit_entries.all().delete()
    case.delete()
    return {"success": True}


@router.delete("/")
def purge_all_cases(request):
    from apps.audit.models import AuditLogEntry

    AuditLogEntry.objects.all().delete()
    Case.objects.all().delete()
    return {"success": True, "message": "All cases and audit entries purged."}
