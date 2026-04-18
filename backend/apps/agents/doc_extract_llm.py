"""LLM-powered document extraction.

Uses the existing OpenAI client to extract structured facts from document text,
with a deterministic regex fallback when the LLM is unavailable or fails.

Each extractor asks GPT-4o-mini for a strictly typed JSON response — way more
robust than regex over real-world PDFs where layouts vary wildly.
"""
from __future__ import annotations

import hashlib
import json
import logging
import textwrap
from pathlib import Path
from typing import Any

from django.conf import settings
from pydantic import BaseModel, Field

from apps.agents.doc_extract import (
    extract_bank_statement as regex_bank,
    extract_cibil as regex_cibil,
    extract_gst_certificate as regex_gst_cert,
    extract_gstin_filings as regex_gstin_filings,
    extract_itr as regex_itr,
    _apply_applicant,
    _apply_bureau,
    _apply_financial,
    _apply_income,
    _apply_income_and_financial,
    _text_for,
)
from apps.cases.models import CaseDocument, DocumentType

logger = logging.getLogger(__name__)


# ---------------------- Pydantic schemas ----------------------


class CibilExtract(BaseModel):
    cibil_score: int | None = Field(None, ge=300, le=900, description="CIBIL score, 300-900")
    utilization_pct: float | None = Field(None, ge=0, le=100)
    enquiries_last_6mo: int | None = Field(None, ge=0, le=200)
    active_loans_count: int | None = Field(None, ge=0, le=100)
    dpd_0: int | None = Field(None, ge=0)
    dpd_1_30: int | None = Field(None, ge=0)
    dpd_31_60: int | None = Field(None, ge=0)
    dpd_61_90: int | None = Field(None, ge=0)
    dpd_90_plus: int | None = Field(None, ge=0)
    notes: str = ""


class BankStatementExtract(BaseModel):
    avg_monthly_balance_inr: int | None = Field(None, ge=0, le=10_000_000_000)
    bounces_last_6mo: int | None = Field(None, ge=0, le=200)
    monthly_inflow_inr: list[float] = Field(default_factory=list)
    monthly_outflow_inr: list[float] = Field(default_factory=list)
    account_holder: str = ""
    bank_name: str = ""
    statement_period: str = ""
    notes: str = ""


class GSTCertExtract(BaseModel):
    gstin: str = ""
    pan: str = ""
    legal_name: str = ""
    registration_date: str = ""
    state_code: str = ""
    notes: str = ""


class GSTINFilingsExtract(BaseModel):
    monthly_taxable_value_inr: list[float] = Field(default_factory=list)
    gst_filings_regular: bool | None = None
    period_covered: str = ""
    total_outward_supplies_inr: float | None = None
    notes: str = ""


class ITRExtract(BaseModel):
    itr_gross_income_inr: int | None = None
    assessment_year: str = ""
    total_tax_paid_inr: int | None = None
    notes: str = ""


# ---------------------- LLM invocation ----------------------


def _call_openai(schema_name: str, schema_desc: str, text: str, model: type[BaseModel]) -> BaseModel | None:
    if not settings.OPENAI_API_KEY or settings.SWARM_SYNTHETIC_MODE:
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=settings.OPENAI_REQUEST_TIMEOUT)
        system = textwrap.dedent(
            f"""
            You are a document extraction agent. Read the provided document text
            (it may be messy OCR from a PDF) and return ONLY valid JSON matching
            the schema {schema_name}. Field descriptions:
            {schema_desc}

            Rules:
            - Use null for any field you cannot confidently find.
            - Return numbers as numbers, not strings.
            - Rupee values: strip '₹', commas, whitespace.
            - NEVER guess — null is always preferable to a made-up value.
            - If the document clearly isn't the expected type, return nulls.
            """
        ).strip()
        completion = client.chat.completions.create(
            model=settings.OPENAI_MODEL_SPECIALIST,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"Document text (truncated):\n---\n{text[:12000]}\n---\nReturn the JSON object now."},
            ],
        )
        raw = completion.choices[0].message.content or "{}"
        data = json.loads(raw)
        return model.model_validate(data)
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM extract failed for %s: %s", schema_name, exc)
        return None


# ---------------------- per-doc-type extractors ----------------------


def llm_extract_cibil(text: str) -> dict[str, Any]:
    if not text:
        return {}
    schema_desc = "cibil_score(300-900), utilization_pct, enquiries_last_6mo, active_loans_count, dpd buckets (0, 1-30, 31-60, 61-90, 90+)"
    out = _call_openai("CibilExtract", schema_desc, text, CibilExtract)
    if not out:
        return regex_cibil(text)
    result: dict[str, Any] = {}
    if out.cibil_score is not None:
        result["cibil_score"] = out.cibil_score
    if out.utilization_pct is not None:
        result["utilization_pct"] = out.utilization_pct
    if out.enquiries_last_6mo is not None:
        result["enquiries_last_6mo"] = out.enquiries_last_6mo
    if out.active_loans_count is not None:
        result["active_loans_count"] = out.active_loans_count
    dpd = {
        "0": out.dpd_0 or 0,
        "1_30": out.dpd_1_30 or 0,
        "31_60": out.dpd_31_60 or 0,
        "61_90": out.dpd_61_90 or 0,
        "90_plus": out.dpd_90_plus or 0,
    }
    if any(v > 0 for v in dpd.values()):
        result["dpd_buckets"] = dpd
    return result


def llm_extract_bank_statement(text: str) -> dict[str, Any]:
    if not text:
        return {}
    schema_desc = "avg_monthly_balance_inr (in ₹, 0-10B cap), bounces_last_6mo, monthly_inflow_inr[], monthly_outflow_inr[], account_holder, bank_name, statement_period"
    out = _call_openai("BankStatementExtract", schema_desc, text, BankStatementExtract)
    if not out:
        return regex_bank(text)
    result: dict[str, Any] = {}
    if out.avg_monthly_balance_inr is not None:
        result["avg_monthly_balance"] = out.avg_monthly_balance_inr
    if out.bounces_last_6mo is not None:
        result["bounces_last_6mo"] = out.bounces_last_6mo
    if out.monthly_inflow_inr:
        result["monthly_inflow"] = out.monthly_inflow_inr[:12]
        result["monthly_revenue"] = out.monthly_inflow_inr[:12]
    if out.monthly_outflow_inr:
        result["monthly_outflow"] = out.monthly_outflow_inr[:12]
    if out.bank_name:
        result["bank_name"] = out.bank_name
    return result


def llm_extract_gst_cert(text: str) -> dict[str, Any]:
    if not text:
        return {}
    schema_desc = "GSTIN (15 chars), PAN (10 chars), legal_name, registration_date (DD/MM/YYYY), state_code"
    out = _call_openai("GSTCertExtract", schema_desc, text, GSTCertExtract)
    if not out:
        return regex_gst_cert(text)
    result: dict[str, Any] = {}
    if out.gstin:
        result["gstin"] = out.gstin
    if out.pan:
        result["pan"] = out.pan
    if out.legal_name:
        result["legal_name"] = out.legal_name
    if out.registration_date:
        result["registration_date"] = out.registration_date
    return result


def llm_extract_gstin_filings(text: str) -> dict[str, Any]:
    if not text:
        return {}
    schema_desc = "monthly_taxable_value_inr[], gst_filings_regular (true if all months filed), total_outward_supplies_inr"
    out = _call_openai("GSTINFilingsExtract", schema_desc, text, GSTINFilingsExtract)
    if not out:
        return regex_gstin_filings(text)
    result: dict[str, Any] = {}
    if out.monthly_taxable_value_inr:
        result["monthly_revenue"] = out.monthly_taxable_value_inr[:12]
    if out.gst_filings_regular is not None:
        result["gst_filings_regular"] = out.gst_filings_regular
    return result


def llm_extract_itr(text: str) -> dict[str, Any]:
    if not text:
        return {}
    schema_desc = "itr_gross_income_inr, assessment_year, total_tax_paid_inr"
    out = _call_openai("ITRExtract", schema_desc, text, ITRExtract)
    if not out:
        return regex_itr(text)
    result: dict[str, Any] = {}
    if out.itr_gross_income_inr:
        result["itr_gross_income"] = out.itr_gross_income_inr
    if out.assessment_year:
        result["assessment_year"] = out.assessment_year
    return result


# ---------------------- dispatcher ----------------------


def extract_and_apply(doc: CaseDocument) -> dict[str, Any]:
    """LLM-first extractor — populates case rows using real document content."""
    text = _text_for(doc)
    out: dict[str, Any] = {}

    try:
        if doc.doc_type == DocumentType.CIBIL:
            out = llm_extract_cibil(text)
            _apply_bureau(doc.case, out)
        elif doc.doc_type == DocumentType.BANK_STATEMENT:
            out = llm_extract_bank_statement(text)
            _apply_financial(doc.case, out)
        elif doc.doc_type == DocumentType.GST_CERTIFICATE:
            out = llm_extract_gst_cert(text)
            _apply_applicant(doc.case, out)
        elif doc.doc_type == DocumentType.GSTIN_FILINGS:
            out = llm_extract_gstin_filings(text)
            _apply_income_and_financial(doc.case, out)
        elif doc.doc_type == DocumentType.ITR:
            out = llm_extract_itr(text)
            _apply_income(doc.case, out)
    except Exception as exc:  # noqa: BLE001
        logger.exception("llm extract failed for %s: %s", doc.original_filename, exc)

    if out:
        meta = doc.extracted_meta or {}
        meta["extracted"] = out
        meta["extractor"] = "llm" if settings.OPENAI_API_KEY and not settings.SWARM_SYNTHETIC_MODE else "regex"
        meta["extract_hash"] = hashlib.sha256(text.encode("utf-8", "ignore")[:4000]).hexdigest()[:12]
        doc.extracted_meta = meta
        doc.save(update_fields=["extracted_meta"])
    return out
