"""Seed realistic-looking synthetic credit cases.

Usage:
  python manage.py seed_cases --count 8

Produces a curated mix of clean, borderline, and stressed cases so the swarm
shows a range of outcomes.
"""
from __future__ import annotations

import random
from typing import Any

from django.core.management.base import BaseCommand

from apps.cases.models import (
    Applicant,
    BehaviourData,
    BureauData,
    Case,
    CaseStatus,
    FinancialData,
    IncomeData,
    KYCData,
    LoanType,
    RiskBand,
)


APPLICANTS = [
    ("Rakesh Traders Pvt Ltd", "FMCG Distribution", "Maharashtra", 96),
    ("Anika Fashions", "Apparel Retail", "Delhi", 48),
    ("Gomti Agri Supplies", "Agri Inputs", "Uttar Pradesh", 132),
    ("Satellite Electricals", "Electrical Trading", "Gujarat", 24),
    ("Nayak Sweets & Namkeens", "Food Processing", "Odisha", 72),
    ("Mehra Logistics", "Logistics", "Haryana", 168),
    ("Chandni Pharma", "Pharma Retail", "Telangana", 36),
    ("Veerendra Hardware", "Hardware", "Karnataka", 84),
]

LOAN_TYPES = [
    LoanType.WORKING_CAPITAL,
    LoanType.INVOICE_FINANCING,
    LoanType.TERM_LOAN,
    LoanType.EQUIPMENT_LOAN,
]


def _case_profile(rng: random.Random, vintage_months: int) -> dict[str, Any]:
    """Return a bundle of realistic metrics scaled by vintage."""
    is_stressed = rng.random() < 0.25
    is_strong = not is_stressed and vintage_months >= 72 and rng.random() < 0.5

    if is_strong:
        cibil = rng.randint(760, 820)
        bounces = 0
        inflow_growth = 0.18
        util = rng.uniform(25, 45)
        kyc = 99.2
        vel = 0
        repay = 96
        rollover = 0.1
        itr = rng.randint(3500000, 6500000)
    elif is_stressed:
        cibil = rng.randint(620, 680)
        bounces = rng.randint(2, 5)
        inflow_growth = -0.05
        util = rng.uniform(70, 92)
        kyc = rng.choice([88.0, 91.0, 94.0])
        vel = rng.randint(1, 3)
        repay = rng.randint(68, 84)
        rollover = rng.uniform(0.4, 0.9)
        itr = rng.randint(1500000, 3500000)
    else:
        cibil = rng.randint(680, 745)
        bounces = rng.randint(0, 2)
        inflow_growth = 0.08
        util = rng.uniform(45, 65)
        kyc = rng.choice([96.0, 97.5, 98.2])
        vel = rng.randint(0, 1)
        repay = rng.randint(85, 93)
        rollover = rng.uniform(0.15, 0.35)
        itr = rng.randint(2500000, 4500000)

    base_inflow = max(500000, itr // 12)
    months = 12
    inflows = []
    outflows = []
    for m in range(months):
        drift = 1 + (inflow_growth * (m / months))
        noise = rng.uniform(0.85, 1.18) if not is_stressed else rng.uniform(0.6, 1.4)
        inflow = int(base_inflow * drift * noise)
        inflows.append(inflow)
        outflows.append(int(inflow * rng.uniform(0.70, 0.92)))

    dscr = round(sum(inflows) / max(1, sum(outflows)), 2)
    leverage = round(rng.uniform(1.1, 3.5) if not is_stressed else rng.uniform(2.8, 5.5), 2)

    return {
        "is_stressed": is_stressed,
        "is_strong": is_strong,
        "cibil": cibil,
        "bounces": bounces,
        "inflows": inflows,
        "outflows": outflows,
        "dscr": dscr,
        "leverage": leverage,
        "util": round(util, 1),
        "kyc": kyc,
        "velocity_anomalies": vel,
        "repay": repay,
        "rollover": round(rollover, 2),
        "itr": itr,
    }


def _external_id(rng: random.Random, existing: set[str]) -> str:
    while True:
        candidate = f"CRP-{rng.randint(80000, 99999)}"
        if candidate not in existing:
            existing.add(candidate)
            return candidate


def generate(count: int = 8, rng: random.Random | None = None) -> list[Case]:
    rng = rng or random.Random(42)
    existing_ids = set(Case.objects.values_list("external_id", flat=True))
    created: list[Case] = []

    for i in range(count):
        name, sector, state, vintage_months = APPLICANTS[i % len(APPLICANTS)]
        loan_type = rng.choice(LOAN_TYPES)
        profile = _case_profile(rng, vintage_months)

        amount = rng.choice([1_200_000, 1_800_000, 2_500_000, 3_100_000, 4_500_000, 5_400_000, 7_200_000])
        risk = RiskBand.LOW if profile["is_strong"] else (RiskBand.HIGH if profile["is_stressed"] else RiskBand.MEDIUM)

        case = Case.objects.create(
            external_id=_external_id(rng, existing_ids),
            applicant_name=name,
            loan_type=loan_type,
            amount_inr=amount,
            sector=sector,
            state=state,
            vintage_years=round(vintage_months / 12.0, 1),
            risk_band=risk,
            status=CaseStatus.INTAKE,
        )

        Applicant.objects.create(
            case=case,
            legal_name=name,
            gstin=f"{rng.randint(10, 37)}ABCDE{rng.randint(1000, 9999)}F1Z5",
            pan=f"ABCDE{rng.randint(1000, 9999)}F",
            industry=sector,
            geography=state,
            vintage_months=vintage_months,
            directors=[{"name": "Director Ji", "din": f"0{rng.randint(1000000, 9999999)}"}],
        )

        FinancialData.objects.create(
            case=case,
            monthly_revenue=profile["inflows"],
            monthly_inflow=profile["inflows"],
            monthly_outflow=profile["outflows"],
            existing_emi=rng.randint(30000, 200000),
            bounces_last_6mo=profile["bounces"],
            avg_monthly_balance=int(sum(profile["inflows"]) / 24),
            dscr=profile["dscr"],
            leverage=profile["leverage"],
        )

        BureauData.objects.create(
            case=case,
            cibil_score=profile["cibil"],
            dpd_buckets={
                "0": 22,
                "1_30": 2 if profile["is_stressed"] else 0,
                "31_60": 1 if profile["is_stressed"] else 0,
                "61_90": 0,
                "90_plus": 0,
            },
            enquiries_last_6mo=rng.randint(0, 4),
            active_loans_count=rng.randint(1, 4),
            utilization_pct=profile["util"],
            trade_lines=[
                {"type": "CC", "status": "active", "balance": rng.randint(50000, 500000)},
                {"type": "TL", "status": "closed", "balance": 0},
            ],
        )

        KYCData.objects.create(
            case=case,
            kyc_match_pct=profile["kyc"],
            pan_gst_linked=True,
            device_blocklist_hit=profile["velocity_anomalies"] >= 3,
            velocity_anomalies=profile["velocity_anomalies"],
            document_authenticity_score=rng.uniform(82, 99),
        )

        IncomeData.objects.create(
            case=case,
            itr_gross_income=profile["itr"],
            itr_prior_year=int(profile["itr"] * rng.uniform(0.85, 1.0)),
            gst_filings_regular=not profile["is_stressed"],
            top_3_buyer_concentration_pct=rng.uniform(32, 70),
            anchor_name=rng.choice(["Reliance Retail", "Tata Trent", "DMart", "Big Basket", "ITC Foods"]),
        )

        BehaviourData.objects.create(
            case=case,
            prior_loans_count=rng.randint(1, 6),
            historical_repayment_pct=profile["repay"],
            avg_tenure_completion_pct=profile["repay"] - rng.randint(2, 8),
            prepayments_count=rng.randint(0, 3),
            rollover_frequency=profile["rollover"],
        )

        created.append(case)

    return created


class Command(BaseCommand):
    help = "Seed synthetic credit underwriting cases."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=8)

    def handle(self, *args, **options):
        created = generate(options["count"])
        self.stdout.write(self.style.SUCCESS(f"Created {len(created)} cases"))
        for case in created:
            self.stdout.write(f" - {case.external_id} · {case.applicant_name} · ₹{case.amount_inr:,}")
