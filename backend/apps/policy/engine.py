"""Deterministic policy rule engine — runs first, LLM narrates afterwards."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from django.conf import settings

from apps.cases.models import Case


@dataclass
class PolicyCheck:
    code: str
    passed: bool
    exception_eligible: bool
    message: str
    severity: str = "medium"


@dataclass
class PolicyResult:
    version: str
    checks: list[PolicyCheck] = field(default_factory=list)
    hard_failures: list[PolicyCheck] = field(default_factory=list)
    exceptions: list[PolicyCheck] = field(default_factory=list)
    required_conditions: list[str] = field(default_factory=list)

    @property
    def stance(self) -> str:
        if self.hard_failures:
            return "reject"
        if self.exceptions:
            return "conditional"
        return "approve"


def _load_policy() -> dict[str, Any]:
    path = Path(settings.SWARM_POLICY_FILE)
    with path.open() as fh:
        return yaml.safe_load(fh)


def evaluate(case: Case) -> PolicyResult:
    policy = _load_policy()
    hb = policy["hard_boundaries"]
    result = PolicyResult(version=policy["version"])

    applicant = getattr(case, "applicant", None)
    bureau = getattr(case, "bureau_data", None)
    kyc = getattr(case, "kyc_data", None)

    # Vintage
    if applicant:
        passed = applicant.vintage_months >= hb["min_vintage_months"]
        result.checks.append(PolicyCheck(
            code="min_vintage",
            passed=passed,
            exception_eligible=applicant.vintage_months >= hb["min_vintage_months"] - 6,
            message=f"Vintage {applicant.vintage_months}mo vs required {hb['min_vintage_months']}mo",
            severity="high" if not passed else "low",
        ))

    # CIBIL
    if bureau:
        passed = bureau.cibil_score >= hb["min_cibil_score"]
        result.checks.append(PolicyCheck(
            code="min_cibil",
            passed=passed,
            exception_eligible=bureau.cibil_score >= hb["min_cibil_score"] - 30,
            message=f"CIBIL {bureau.cibil_score} vs required {hb['min_cibil_score']}",
            severity="high" if not passed else "low",
        ))

        # DPD 90+
        dpd90 = int((bureau.dpd_buckets or {}).get("90_plus", 0))
        passed = dpd90 <= hb["max_dpd_90_plus_count"]
        result.checks.append(PolicyCheck(
            code="no_90_plus_dpd",
            passed=passed,
            exception_eligible=False,
            message=f"90+ DPD count {dpd90} must be <= {hb['max_dpd_90_plus_count']}",
            severity="high" if not passed else "low",
        ))

        # Utilization
        passed = bureau.utilization_pct <= hb["max_utilization_pct"]
        result.checks.append(PolicyCheck(
            code="max_utilization",
            passed=passed,
            exception_eligible=bureau.utilization_pct <= hb["max_utilization_pct"] + 10,
            message=f"Utilization {bureau.utilization_pct}% vs cap {hb['max_utilization_pct']}%",
            severity="medium" if not passed else "low",
        ))

    # Amount vs vintage
    if applicant:
        cap = None
        for tier in hb["max_amount_by_vintage"]:
            if applicant.vintage_months >= tier["min_vintage_months"]:
                cap = tier["max_amount_inr"]
        if cap is not None:
            passed = case.amount_inr <= cap
            result.checks.append(PolicyCheck(
                code="amount_vs_vintage",
                passed=passed,
                exception_eligible=case.amount_inr <= int(cap * 1.1),
                message=f"Ask {case.amount_inr} vs cap {cap} at vintage {applicant.vintage_months}mo",
                severity="medium" if not passed else "low",
            ))

    # Industry
    if case.sector in hb.get("disallowed_industries", []):
        result.checks.append(PolicyCheck(
            code="disallowed_industry",
            passed=False,
            exception_eligible=False,
            message=f"Sector {case.sector} is disallowed",
            severity="high",
        ))

    # KYC
    if kyc:
        passed = kyc.kyc_match_pct >= hb["min_kyc_match_pct"]
        result.checks.append(PolicyCheck(
            code="min_kyc_match",
            passed=passed,
            exception_eligible=False,
            message=f"KYC match {kyc.kyc_match_pct}% vs min {hb['min_kyc_match_pct']}%",
            severity="high" if not passed else "low",
        ))

    for check in result.checks:
        if not check.passed:
            if check.exception_eligible:
                result.exceptions.append(check)
            else:
                result.hard_failures.append(check)

    # Required conditions for conditional path
    if result.exceptions and not result.hard_failures:
        result.required_conditions = list(policy["exception_eligible"]["conditions"])

    return result
