"""Audit ledger read-only endpoints."""
from __future__ import annotations

from uuid import UUID

from django.shortcuts import get_object_or_404
from ninja import Router

from apps.api.schemas import AuditLedgerOut
from apps.audit.models import AuditLogService
from apps.cases.models import Case

router = Router(tags=["audit"])


@router.get("/{case_id}/audit/", response=AuditLedgerOut)
def get_audit(request, case_id: UUID):
    case = get_object_or_404(Case, id=case_id)
    entries = list(case.audit_entries.order_by("sequence"))
    valid, broken = AuditLogService.verify_chain(case)
    return {
        "case_id": case.id,
        "entries": [
            {
                "id": e.id,
                "sequence": e.sequence,
                "timestamp": e.timestamp,
                "event_type": e.event_type,
                "actor": e.actor,
                "title": e.title,
                "body": e.body,
                "payload": e.payload or {},
                "prev_hash": e.prev_hash,
                "row_hash": e.row_hash,
            }
            for e in entries
        ],
        "chain_valid": valid,
        "broken_sequences": broken,
    }
