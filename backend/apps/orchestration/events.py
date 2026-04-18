"""SSE event publisher using django-eventstream.

Every agent lifecycle emits an event on a per-case channel (``case-{uuid}``)
which the frontend subscribes to via the /events/ endpoint.
"""
from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone

logger = logging.getLogger(__name__)


def channel_for(case_id: str) -> str:
    return f"case-{case_id}"


def publish(case_id: str, event_type: str, data: dict[str, Any]) -> None:
    try:
        from django_eventstream import send_event  # type: ignore[import-not-found]
    except ImportError:
        logger.debug("django_eventstream not available; skipping publish")
        return

    payload = {
        "type": event_type,
        "timestamp": timezone.now().isoformat(),
        **data,
    }
    try:
        send_event(channel_for(case_id), event_type, payload)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to publish SSE event")
