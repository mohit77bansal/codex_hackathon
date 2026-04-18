"""Thin OpenAI client wrapper with structured output + synthetic fallback.

When ``OPENAI_API_KEY`` is absent or ``SWARM_SYNTHETIC_MODE`` is True, we fall back
to a deterministic heuristic generator so the full pipeline runs end-to-end
without any external calls. This lets the demo work offline while the user is
still securing the API key, and the moment a key is provided the same code path
produces real LLM output.
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Callable

from django.conf import settings
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)


@dataclass
class LLMResponse:
    data: dict[str, Any]
    raw: dict[str, Any]
    model: str
    latency_ms: int
    cost_usd: float
    synthetic: bool


class LLMError(Exception):
    pass


def _deterministic_seed(case_id: str, agent_key: str) -> int:
    digest = hashlib.sha256(f"{case_id}:{agent_key}".encode()).hexdigest()
    return int(digest[:8], 16)


def _openai_available() -> bool:
    return bool(settings.OPENAI_API_KEY) and not settings.SWARM_SYNTHETIC_MODE


def _call_openai(
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    schema: type[BaseModel],
    temperature: float,
    timeout: int,
) -> LLMResponse:
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=timeout)

    started = time.time()
    completion = client.chat.completions.create(
        model=model,
        temperature=temperature,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt + "\n\nReturn a single JSON object that matches the schema provided in the system prompt. No prose outside JSON."},
        ],
    )
    latency_ms = int((time.time() - started) * 1000)
    content = completion.choices[0].message.content or "{}"
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise LLMError(f"Model returned non-JSON content: {exc}") from exc

    try:
        validated = schema.model_validate(data)
    except ValidationError as exc:
        raise LLMError(f"Schema validation failed: {exc}") from exc

    usage = getattr(completion, "usage", None)
    cost_usd = _estimate_cost(model, usage)

    return LLMResponse(
        data=validated.model_dump(),
        raw={"content": content, "usage": usage.model_dump() if usage else {}},
        model=model,
        latency_ms=latency_ms,
        cost_usd=cost_usd,
        synthetic=False,
    )


def _estimate_cost(model: str, usage: Any) -> float:
    if not usage:
        return 0.0
    in_per_1k = 0.00015 if "mini" in model else 0.0025
    out_per_1k = 0.0006 if "mini" in model else 0.010
    prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
    completion_tokens = getattr(usage, "completion_tokens", 0) or 0
    return (prompt_tokens / 1000.0) * in_per_1k + (completion_tokens / 1000.0) * out_per_1k


def call_structured(
    *,
    case_id: str,
    agent_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    schema: type[BaseModel],
    synthetic_fn: Callable[[int], BaseModel],
    temperature: float = 0.2,
    timeout: int | None = None,
    max_retries: int = 2,
) -> LLMResponse:
    """Call the LLM with structured output or fall back to deterministic synthetic."""
    if not _openai_available():
        started = time.time()
        seed = _deterministic_seed(case_id, agent_key)
        obj = synthetic_fn(seed)
        latency_ms = int((time.time() - started) * 1000) + 120
        return LLMResponse(
            data=obj.model_dump(),
            raw={"synthetic": True, "seed": seed},
            model=f"synthetic:{model}",
            latency_ms=latency_ms,
            cost_usd=0.0,
            synthetic=True,
        )

    request_timeout = timeout or settings.OPENAI_REQUEST_TIMEOUT
    last_err: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return _call_openai(
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                schema=schema,
                temperature=temperature,
                timeout=request_timeout,
            )
        except LLMError as exc:
            last_err = exc
            logger.warning("LLM schema violation attempt=%s err=%s", attempt, exc)
            continue
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            logger.exception("LLM call failed attempt=%s", attempt)
            continue

    logger.error("LLM failed after retries, falling back to synthetic: %s", last_err)
    started = time.time()
    seed = _deterministic_seed(case_id, agent_key)
    obj = synthetic_fn(seed)
    latency_ms = int((time.time() - started) * 1000) + 50
    return LLMResponse(
        data=obj.model_dump(),
        raw={"synthetic": True, "seed": seed, "fallback_reason": str(last_err)},
        model=f"synthetic:{model}",
        latency_ms=latency_ms,
        cost_usd=0.0,
        synthetic=True,
    )
