from django.contrib import admin

from .models import (
    Applicant,
    BehaviourData,
    BureauData,
    Case,
    CaseDocument,
    FinancialData,
    IncomeData,
    KYCData,
    PortfolioSnapshot,
)


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ("external_id", "applicant_name", "loan_type", "amount_inr", "status", "verdict", "consensus_score")
    list_filter = ("status", "risk_band", "loan_type")
    search_fields = ("external_id", "applicant_name")


admin.site.register(Applicant)
admin.site.register(FinancialData)
admin.site.register(BureauData)
admin.site.register(KYCData)
admin.site.register(IncomeData)
admin.site.register(BehaviourData)
admin.site.register(PortfolioSnapshot)
admin.site.register(CaseDocument)
