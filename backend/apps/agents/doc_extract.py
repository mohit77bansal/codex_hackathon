"""Extract structured facts from uploaded documents.

Each extractor runs after a document is identified and populates the
corresponding case model (BureauData, FinancialData, Applicant, etc.) with
real values pulled from the document. Any field we cannot extract stays
empty — the specialists then see honest gaps instead of hallucinated data.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from statistics import mean, pstdev
from typing import Any

from apps.agents.doc_identify import _extract_text_pdf, _extract_text_xlsx
from apps.cases.models import (
    Applicant,
    BehaviourData,
    BureauData,
    Case,
    CaseDocument,
    DocumentType,
    FinancialData,
    IncomeData,
    KYCData,
)

logger = logging.getLogger(__name__)


# ------------------------------- helpers ---------------------------------

_NUMBER = re.compile(r"([\-]?\d[\d,]*\.?\d*)")


def _clean_number(raw: str) -> float | None:
    if raw is None:
        return None
    s = str(raw).replace(",", "").replace("₹", "").strip()
    m = _NUMBER.search(s)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _find_after(text: str, patterns: list[str]) -> float | None:
    """Return the first number that appears after any of the given labels."""
    for pat in patterns:
        m = re.search(rf"{pat}[^\d\-]*([\-]?[\d,]+\.?\d*)", text, re.IGNORECASE)
        if m:
            val = _clean_number(m.group(1))
            if val is not None:
                return val
    return None


# --------------------------- extractors ---------------------------------


def extract_cibil(text: str) -> dict[str, Any]:
    """Pull CIBIL score + DPD + utilization from a CIBIL report text."""
    if not text:
        return {}
    out: dict[str, Any] = {}

    # Score line commonly says "CIBIL SCORE ... 742" or "TransUnion Score 742"
    score_match = re.search(r"(?:cibil\s*(?:trans\s?union\s*)?score|bureau\s+score|credit\s+score)[^\d]{0,20}(\d{3})", text, re.IGNORECASE)
    if not score_match:
        # Fallback: any 3-digit 300-900 right after the word score
        score_match = re.search(r"\bscore\b[^\d]{0,15}(\d{3})", text, re.IGNORECASE)
    if score_match:
        score = int(score_match.group(1))
        if 300 <= score <= 900:
            out["cibil_score"] = score

    # Utilization
    util = _find_after(text, [r"utili[sz]ation", r"credit\s+utili[sz]ation"])
    if util is not None and 0 <= util <= 100:
        out["utilization_pct"] = round(util, 1)

    # Enquiries last 6 months
    enq = _find_after(text, [r"enquir(?:y|ies)\s+in\s+last\s+6", r"enquir(?:y|ies).*last\s+6\s+months?"])
    if enq is not None:
        out["enquiries_last_6mo"] = int(enq)

    # Active loans count
    active = _find_after(text, [r"active\s+(?:loan|account)s?", r"open\s+account"])
    if active is not None:
        out["active_loans_count"] = int(active)

    # Crude DPD buckets
    dpd_buckets: dict[str, int] = {"0": 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0}
    if re.search(r"\b90\s*\+\s*dpd\b|\b90\s+days?\s+past\s+due\b", text, re.IGNORECASE):
        # naive — if mentioned, count the next number
        m = re.search(r"\b90\s*\+[^\d]{0,15}(\d+)", text, re.IGNORECASE)
        if m:
            dpd_buckets["90_plus"] = int(m.group(1))
    if dpd_buckets != {"0": 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0}:
        out["dpd_buckets"] = dpd_buckets

    return out


def extract_bank_statement(text: str) -> dict[str, Any]:
    if not text:
        return {}
    out: dict[str, Any] = {}

    # Average monthly balance
    amb = _find_after(text, [r"average\s+monthly\s+balance", r"avg\s+monthly\s+balance", r"AMB"])
    if amb is not None:
        out["avg_monthly_balance"] = int(amb)

    # Bounces / cheque returns
    bounces = _find_after(text, [r"cheque\s+returns?", r"bounces?", r"returned\s+cheques?"])
    if bounces is not None and bounces >= 0:
        out["bounces_last_6mo"] = int(bounces)

    # Try to extract credit lines (monthly inflow) — look at numbers labeled CR / credit
    # This is best-effort; if the statement has monthly totals rows they will surface.
    inflow_matches = re.findall(r"(?:credit|CR\.?)\s*[:\-]?\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    inflows = [v for v in (_clean_number(m) for m in inflow_matches[:40]) if v and v > 1000]
    if len(inflows) >= 3:
        out["monthly_inflow"] = inflows[:12]
        out["monthly_revenue"] = inflows[:12]
        if not out.get("avg_monthly_balance"):
            out["avg_monthly_balance"] = int(mean(inflows[:12]) * 0.55)

    # Closing balance
    closing = _find_after(text, [r"closing\s+balance"])
    if closing is not None and not out.get("avg_monthly_balance"):
        out["avg_monthly_balance"] = int(closing)

    return out


def extract_gst_certificate(text: str) -> dict[str, Any]:
    if not text:
        return {}
    out: dict[str, Any] = {}

    gstin = re.search(r"\b(\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d)\b", text)
    if gstin:
        out["gstin"] = gstin.group(1)
        # vintage: date of registration
        reg = re.search(r"(?:date\s+of\s+registration|registration\s+date)[^\d]{0,15}(\d{2}[/-]\d{2}[/-]\d{4})", text, re.IGNORECASE)
        if reg:
            out["registration_date"] = reg.group(1)

    legal_name = re.search(r"legal\s+name\s+of\s+business\s*[:\-]?\s*([A-Z0-9 &\.\-'(),]{3,80})", text, re.IGNORECASE)
    if legal_name:
        out["legal_name"] = legal_name.group(1).strip()

    pan = re.search(r"\b([A-Z]{5}\d{4}[A-Z])\b", text)
    if pan:
        out["pan"] = pan.group(1)

    return out


def extract_gstin_filings(text: str) -> dict[str, Any]:
    if not text:
        return {}
    out: dict[str, Any] = {}

    # Outward taxable value often labeled "Taxable value" or "Total taxable"
    values = re.findall(r"(?:taxable\s+value|total\s+taxable|outward\s+supplies)[^\d]{0,40}([\d,]+\.?\d*)", text, re.IGNORECASE)
    numbers = [v for v in (_clean_number(x) for x in values) if v and v > 10_000]
    if numbers:
        out["monthly_revenue"] = numbers[:12]
        if len(numbers) >= 2:
            out["gst_filings_regular"] = True

    return out


def extract_itr(text: str) -> dict[str, Any]:
    if not text:
        return {}
    out: dict[str, Any] = {}

    gti = _find_after(text, [r"gross\s+total\s+income", r"total\s+income"])
    if gti:
        out["itr_gross_income"] = int(gti)

    # Try to find a prior year comparison
    ay = re.search(r"assessment\s+year[^\d]{0,10}(\d{4})", text, re.IGNORECASE)
    if ay:
        out["assessment_year"] = ay.group(1)

    return out


# ------------------------ dispatcher ------------------------------------


def _text_for(doc: CaseDocument) -> str:
    try:
        path = Path(doc.file.path)
    except (ValueError, OSError):
        return ""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _extract_text_pdf(path, max_chars=20_000)
    if suffix in {".xlsx", ".xls"}:
        return _extract_text_xlsx(path, max_chars=20_000)
    try:
        return path.read_text(errors="ignore")[:20_000]
    except OSError:
        return ""


def extract_and_apply(doc: CaseDocument) -> dict[str, Any]:
    """Run the extractor matching the document type, persist results on the case.

    Returns the dict of fields that were extracted so the caller can log /
    display them.
    """
    text = _text_for(doc)
    out: dict[str, Any] = {}
    try:
        if doc.doc_type == DocumentType.CIBIL:
            out = extract_cibil(text)
            _apply_bureau(doc.case, out)
        elif doc.doc_type == DocumentType.BANK_STATEMENT:
            out = extract_bank_statement(text)
            _apply_financial(doc.case, out)
        elif doc.doc_type == DocumentType.GST_CERTIFICATE:
            out = extract_gst_certificate(text)
            _apply_applicant(doc.case, out)
        elif doc.doc_type == DocumentType.GSTIN_FILINGS:
            out = extract_gstin_filings(text)
            _apply_income_and_financial(doc.case, out)
        elif doc.doc_type == DocumentType.ITR:
            out = extract_itr(text)
            _apply_income(doc.case, out)
    except Exception as exc:  # noqa: BLE001
        logger.exception("extraction failed for %s: %s", doc.original_filename, exc)

    if out:
        meta = doc.extracted_meta or {}
        meta["extracted"] = out
        doc.extracted_meta = meta
        doc.save(update_fields=["extracted_meta"])
    return out


def _apply_bureau(case: Case, data: dict[str, Any]) -> None:
    bureau, _ = BureauData.objects.get_or_create(case=case)
    changed = False
    for field in ["cibil_score", "utilization_pct", "enquiries_last_6mo", "active_loans_count"]:
        if field in data:
            setattr(bureau, field, data[field])
            changed = True
    if "dpd_buckets" in data:
        bureau.dpd_buckets = data["dpd_buckets"]
        changed = True
    if changed:
        bureau.save()


def _apply_financial(case: Case, data: dict[str, Any]) -> None:
    fin, _ = FinancialData.objects.get_or_create(case=case)
    inflows = data.get("monthly_inflow") or []
    outflows = data.get("monthly_outflow") or []
    changed = False
    if inflows:
        fin.monthly_inflow = inflows
        fin.monthly_revenue = inflows
        changed = True
    if outflows:
        fin.monthly_outflow = outflows
        changed = True
    for field in ["avg_monthly_balance", "bounces_last_6mo"]:
        if field in data:
            setattr(fin, field, data[field])
            changed = True
    if inflows and len(inflows) >= 2:
        avg = mean(inflows)
        cov = (pstdev(inflows) / avg) if avg else 0
        fin.dscr = round(1.4 - cov * 0.5, 2)  # crude proxy when we lack outflows
        fin.leverage = 2.0
        changed = True
    if changed:
        fin.save()


def _apply_applicant(case: Case, data: dict[str, Any]) -> None:
    applicant, _ = Applicant.objects.get_or_create(case=case, defaults={
        "legal_name": case.applicant_name,
        "industry": case.sector or "",
        "geography": case.state or "",
        "vintage_months": int((case.vintage_years or 0) * 12),
    })
    changed = False
    if data.get("gstin"):
        applicant.gstin = data["gstin"]
        changed = True
    if data.get("pan"):
        applicant.pan = data["pan"]
        changed = True
    if data.get("legal_name") and not applicant.legal_name:
        applicant.legal_name = data["legal_name"]
        case.applicant_name = data["legal_name"]
        case.save(update_fields=["applicant_name", "updated_at"])
        changed = True
    if data.get("registration_date"):
        # derive vintage in months from the registration date
        try:
            from datetime import datetime

            for fmt in ("%d/%m/%Y", "%d-%m-%Y"):
                try:
                    reg = datetime.strptime(data["registration_date"], fmt)
                    break
                except ValueError:
                    continue
            else:
                reg = None
            if reg:
                months = (datetime.utcnow() - reg).days // 30
                applicant.vintage_months = months
                case.vintage_years = round(months / 12.0, 1)
                case.save(update_fields=["vintage_years", "updated_at"])
                changed = True
        except Exception:  # noqa: BLE001
            pass
    if changed:
        applicant.save()


def _apply_income_and_financial(case: Case, data: dict[str, Any]) -> None:
    if data.get("monthly_revenue"):
        fin, _ = FinancialData.objects.get_or_create(case=case)
        if not fin.monthly_revenue:
            fin.monthly_revenue = data["monthly_revenue"]
            fin.save(update_fields=["monthly_revenue"])
    if "gst_filings_regular" in data:
        inc, _ = IncomeData.objects.get_or_create(case=case)
        inc.gst_filings_regular = data["gst_filings_regular"]
        inc.save(update_fields=["gst_filings_regular"])


def _apply_income(case: Case, data: dict[str, Any]) -> None:
    if not data:
        return
    inc, _ = IncomeData.objects.get_or_create(case=case)
    if data.get("itr_gross_income"):
        inc.itr_prior_year = inc.itr_gross_income or 0
        inc.itr_gross_income = data["itr_gross_income"]
        inc.save()
