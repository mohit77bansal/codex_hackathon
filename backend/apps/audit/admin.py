from django.contrib import admin

from .models import AuditLogEntry


@admin.register(AuditLogEntry)
class AuditLogEntryAdmin(admin.ModelAdmin):
    list_display = ("case", "sequence", "timestamp", "event_type", "actor", "title")
    list_filter = ("event_type",)
    search_fields = ("case__external_id", "title", "body")
    readonly_fields = ("id", "case", "sequence", "timestamp", "event_type", "actor", "title", "body", "payload", "prev_hash", "row_hash")

    def has_add_permission(self, request):  # noqa: D401
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False
