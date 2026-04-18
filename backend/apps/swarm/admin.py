from django.contrib import admin

from .models import AgentPosition, AgentRun, Debate, FinalDecision, LeadReconciliation


@admin.register(AgentRun)
class AgentRunAdmin(admin.ModelAdmin):
    list_display = ("case", "agent_key", "status", "latency_ms", "created_at")
    list_filter = ("agent_key", "status")
    search_fields = ("case__external_id",)


@admin.register(FinalDecision)
class FinalDecisionAdmin(admin.ModelAdmin):
    list_display = ("case", "verdict", "confidence", "created_at", "override_by_user")
    list_filter = ("verdict",)


admin.site.register(AgentPosition)
admin.site.register(Debate)
admin.site.register(LeadReconciliation)
