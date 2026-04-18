"""Deterministic feature pre-processors.

Every specialist first computes a fixed feature bundle from case data and
passes those numerics into the LLM prompt. This stabilizes outputs and keeps
calculations out of the model's head.
"""
from __future__ import annotations

from statistics import mean, pstdev
from typing import Any

from apps.cases.models import Case


def _safe_div(a: float, b: float) -> float:
    return round(a / b, 3) if b else 0.0


def financial_features(case: Case) -> dict[str, Any]:
    fd = getattr(case, "financial_data", None)
    bd = getattr(case, "bureau_data", None)
    if not fd:
        return {}
    inflows = fd.monthly_inflow or []
    outflows = fd.monthly_outflow or []
    avg_in = mean(inflows) if inflows else 0.0
    cov = (pstdev(inflows) / avg_in) if inflows and avg_in else 0.0
    dpd_plus = 0
    if bd:
        buckets = bd.dpd_buckets or {}
        dpd_plus = int(buckets.get("31_60", 0)) + int(buckets.get("61_90", 0)) + int(buckets.get("90_plus", 0))
    return {
        "avg_monthly_inflow": round(avg_in, 0),
        "inflow_cov": round(cov, 3),
        "dscr": fd.dscr,
        "leverage": fd.leverage,
        "bounces_last_6mo": fd.bounces_last_6mo,
        "avg_monthly_balance": fd.avg_monthly_balance,
        "dpd_30_plus_count": dpd_plus,
        "cibil_score": bd.cibil_score if bd else None,
        "utilization_pct": bd.utilization_pct if bd else None,
    }


def bank_features(case: Case) -> dict[str, Any]:
    fd = getattr(case, "financial_data", None)
    if not fd:
        return {}
    inflows = fd.monthly_inflow or []
    return {
        "avg_monthly_inflow": round(mean(inflows), 0) if inflows else 0,
        "inflow_cov": round((pstdev(inflows) / mean(inflows)) if inflows and mean(inflows) else 0.0, 3),
        "bounces_last_6mo": fd.bounces_last_6mo,
        "avg_monthly_balance": fd.avg_monthly_balance,
        "months_of_history": len(inflows),
    }


def fraud_features(case: Case) -> dict[str, Any]:
    kd = getattr(case, "kyc_data", None)
    if not kd:
        return {}
    return {
        "kyc_match_pct": kd.kyc_match_pct,
        "pan_gst_linked": kd.pan_gst_linked,
        "device_blocklist_hit": kd.device_blocklist_hit,
        "velocity_anomalies": kd.velocity_anomalies,
        "document_authenticity_score": kd.document_authenticity_score,
    }


def income_features(case: Case) -> dict[str, Any]:
    inc = getattr(case, "income_data", None)
    if not inc:
        return {}
    growth = _safe_div(inc.itr_gross_income - inc.itr_prior_year, inc.itr_prior_year or 1)
    return {
        "itr_gross_income": inc.itr_gross_income,
        "itr_prior_year": inc.itr_prior_year,
        "itr_yoy_growth": growth,
        "gst_filings_regular": inc.gst_filings_regular,
        "top_3_buyer_concentration_pct": inc.top_3_buyer_concentration_pct,
    }


def behaviour_features(case: Case) -> dict[str, Any]:
    bh = getattr(case, "behaviour_data", None)
    if not bh:
        return {}
    return {
        "prior_loans_count": bh.prior_loans_count,
        "historical_repayment_pct": bh.historical_repayment_pct,
        "avg_tenure_completion_pct": bh.avg_tenure_completion_pct,
        "prepayments_count": bh.prepayments_count,
        "rollover_frequency": bh.rollover_frequency,
    }


def case_summary(case: Case) -> dict[str, Any]:
    """A compact summary passed to every agent for context."""
    applicant = getattr(case, "applicant", None)
    return {
        "external_id": case.external_id,
        "applicant": case.applicant_name,
        "loan_type": case.loan_type,
        "amount_inr": case.amount_inr,
        "sector": case.sector,
        "state": case.state,
        "vintage_years": float(case.vintage_years),
        "industry": applicant.industry if applicant else "",
        "geography": applicant.geography if applicant else "",
    }
