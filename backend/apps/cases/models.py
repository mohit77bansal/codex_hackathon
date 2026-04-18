import uuid

from django.db import models


class CaseStatus(models.TextChoices):
    INTAKE = "intake", "Intake"
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    DEBATING = "debating", "Debating"
    DECIDED = "decided", "Decided"
    OVERRIDDEN = "overridden", "Overridden"
    FAILED = "failed", "Failed"


class RiskBand(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


class LoanType(models.TextChoices):
    WORKING_CAPITAL = "working_capital", "Working Capital"
    INVOICE_FINANCING = "invoice_financing", "Invoice Financing"
    TERM_LOAN = "term_loan", "Term Loan"
    EQUIPMENT_LOAN = "equipment_loan", "Equipment Loan"


class Case(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    external_id = models.CharField(max_length=32, unique=True, help_text="e.g. CRP-88421")
    applicant_name = models.CharField(max_length=200)
    loan_type = models.CharField(max_length=32, choices=LoanType.choices)
    amount_inr = models.BigIntegerField()
    sector = models.CharField(max_length=120)
    state = models.CharField(max_length=80)
    vintage_years = models.DecimalField(max_digits=4, decimal_places=1)

    status = models.CharField(max_length=20, choices=CaseStatus.choices, default=CaseStatus.INTAKE)
    risk_band = models.CharField(max_length=10, choices=RiskBand.choices, default=RiskBand.MEDIUM)
    policy_version = models.CharField(max_length=32, default="v1")

    verdict = models.CharField(max_length=32, blank=True, default="")
    consensus_score = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.external_id} · {self.applicant_name}"


class Applicant(models.Model):
    case = models.OneToOneField(Case, on_delete=models.CASCADE, related_name="applicant")
    legal_name = models.CharField(max_length=200)
    gstin = models.CharField(max_length=15, blank=True)
    pan = models.CharField(max_length=10, blank=True)
    industry = models.CharField(max_length=120)
    geography = models.CharField(max_length=120)
    vintage_months = models.IntegerField()
    directors = models.JSONField(default=list, blank=True)

    def __str__(self) -> str:
        return self.legal_name


class FinancialData(models.Model):
    case = models.OneToOneField(Case, on_delete=models.CASCADE, related_name="financial_data")
    monthly_revenue = models.JSONField(default=list, help_text="List of 12-24 monthly revenue figures")
    monthly_inflow = models.JSONField(default=list)
    monthly_outflow = models.JSONField(default=list)
    existing_emi = models.IntegerField(default=0)
    bounces_last_6mo = models.IntegerField(default=0)
    avg_monthly_balance = models.IntegerField(default=0)
    dscr = models.FloatField(default=0.0)
    leverage = models.FloatField(default=0.0)

    class Meta:
        verbose_name_plural = "Financial data"


class BureauData(models.Model):
    case = models.OneToOneField(Case, on_delete=models.CASCADE, related_name="bureau_data")
    cibil_score = models.IntegerField(default=700)
    dpd_buckets = models.JSONField(
        default=dict,
        help_text="e.g. {'0': 22, '1_30': 2, '31_60': 0, '61_90': 0, '90_plus': 0}",
    )
    enquiries_last_6mo = models.IntegerField(default=0)
    active_loans_count = models.IntegerField(default=0)
    utilization_pct = models.FloatField(default=0.0)
    trade_lines = models.JSONField(default=list)

    class Meta:
        verbose_name_plural = "Bureau data"


class KYCData(models.Model):
    case = models.OneToOneField(Case, on_delete=models.CASCADE, related_name="kyc_data")
    kyc_match_pct = models.FloatField(default=99.0)
    pan_gst_linked = models.BooleanField(default=True)
    device_blocklist_hit = models.BooleanField(default=False)
    velocity_anomalies = models.IntegerField(default=0)
    document_authenticity_score = models.FloatField(default=95.0)


class IncomeData(models.Model):
    case = models.OneToOneField(Case, on_delete=models.CASCADE, related_name="income_data")
    itr_gross_income = models.BigIntegerField(default=0)
    itr_prior_year = models.BigIntegerField(default=0)
    gst_filings_regular = models.BooleanField(default=True)
    top_3_buyer_concentration_pct = models.FloatField(default=0.0)
    anchor_name = models.CharField(max_length=200, blank=True)


class BehaviourData(models.Model):
    case = models.OneToOneField(Case, on_delete=models.CASCADE, related_name="behaviour_data")
    prior_loans_count = models.IntegerField(default=0)
    historical_repayment_pct = models.FloatField(default=0.0)
    avg_tenure_completion_pct = models.FloatField(default=0.0)
    prepayments_count = models.IntegerField(default=0)
    rollover_frequency = models.FloatField(default=0.0)


class DocumentType(models.TextChoices):
    CIBIL = "cibil", "CIBIL Report"
    BANK_STATEMENT = "bank_statement", "Bank Statement"
    GST_CERTIFICATE = "gst_certificate", "GST Certificate"
    GSTIN_FILINGS = "gstin_filings", "GSTIN Filings"
    BANK_AC_AUTH = "bank_ac_auth", "Bank Account Authentication"
    ITR = "itr", "ITR"
    LEDGER = "ledger", "Ledger"
    OTHER = "other", "Other"


def _document_upload_path(instance: "CaseDocument", filename: str) -> str:
    return f"documents/{instance.case_id}/{filename}"


class CaseDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=32, choices=DocumentType.choices)
    original_filename = models.CharField(max_length=255)
    file = models.FileField(upload_to=_document_upload_path)
    size_bytes = models.BigIntegerField(default=0)
    mime_type = models.CharField(max_length=120, blank=True)
    source = models.CharField(max_length=32, default="upload", help_text="upload | sample")
    extracted_meta = models.JSONField(default=dict, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]
        indexes = [models.Index(fields=["case", "doc_type"])]

    def __str__(self) -> str:
        return f"{self.get_doc_type_display()} · {self.original_filename}"


class PortfolioSnapshot(models.Model):
    as_of_date = models.DateField(unique=True)
    industry_mix = models.JSONField(default=dict)
    geography_mix = models.JSONField(default=dict)
    hhi = models.FloatField(default=0.0)
    total_exposure_inr = models.BigIntegerField(default=0)
    anchor_concentration = models.JSONField(default=dict)

    class Meta:
        ordering = ["-as_of_date"]
