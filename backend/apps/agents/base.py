"""Base class for all agents.

An Agent is a callable unit that, given a Case, produces a structured output
persisted to the database. The base handles:

* timestamping and latency
* AgentRun + AuditLogEntry persistence
* prompt rendering + structured LLM invocation
* synthetic fallback for offline operation
"""
from __future__ import annotations

import hashlib
import logging
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.utils import timezone
from pydantic import BaseModel

from apps.audit.models import AuditEventType, AuditLogService
from apps.cases.models import Case
from apps.llm.client import LLMResponse, call_structured
from apps.swarm.models import AgentRun, AgentRunStatus

logger = logging.getLogger(__name__)


@dataclass
class AgentContext:
    case: Case
    agent_run: AgentRun
    features: dict[str, Any]


class BaseAgent(ABC):
    agent_key: str = ""
    display_name: str = ""
    model_tier: str = "specialist"  # or "orchestrator"
    temperature: float = 0.2

    def model_name(self) -> str:
        return (
            settings.OPENAI_MODEL_SPECIALIST
            if self.model_tier == "specialist"
            else settings.OPENAI_MODEL_ORCHESTRATOR
        )

    @abstractmethod
    def build_features(self, case: Case) -> dict[str, Any]:
        ...

    @abstractmethod
    def system_prompt(self) -> str:
        ...

    @abstractmethod
    def user_prompt(self, ctx: AgentContext, extra: dict[str, Any] | None = None) -> str:
        ...

    @abstractmethod
    def output_schema(self) -> type[BaseModel]:
        ...

    @abstractmethod
    def synthetic(self, ctx: AgentContext, seed: int) -> BaseModel:
        ...

    def run(self, case: Case, extra: dict[str, Any] | None = None) -> tuple[AgentRun, dict[str, Any]]:
        features = self.build_features(case)
        prompt_hash = hashlib.sha256(
            (self.system_prompt() + str(features)).encode()
        ).hexdigest()[:16]

        agent_run = AgentRun.objects.create(
            case=case,
            agent_key=self.agent_key,
            model=self.model_name(),
            prompt_hash=prompt_hash,
            seed=str(abs(hash((str(case.id), self.agent_key))) % 10_000_000),
            status=AgentRunStatus.RUNNING,
            started_at=timezone.now(),
        )

        AuditLogService.append(
            case=case,
            event_type=AuditEventType.AGENT_STARTED,
            actor=f"agent:{self.agent_key}",
            title=f"{self.display_name} started",
            body=f"Model {self.model_name()} · prompt hash {prompt_hash}",
            payload={"agent_key": self.agent_key, "features": features},
        )

        ctx = AgentContext(case=case, agent_run=agent_run, features=features)
        schema = self.output_schema()

        try:
            response: LLMResponse = call_structured(
                case_id=str(case.id),
                agent_key=self.agent_key,
                model=self.model_name(),
                system_prompt=self.system_prompt(),
                user_prompt=self.user_prompt(ctx, extra),
                schema=schema,
                synthetic_fn=lambda seed: self.synthetic(ctx, seed),
                temperature=self.temperature,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Agent %s failed for case %s", self.agent_key, case.external_id)
            agent_run.status = AgentRunStatus.FAILED
            agent_run.error = str(exc)
            agent_run.completed_at = timezone.now()
            agent_run.save()
            AuditLogService.append(
                case=case,
                event_type=AuditEventType.AGENT_FAILED,
                actor=f"agent:{self.agent_key}",
                title=f"{self.display_name} failed",
                body=str(exc),
            )
            raise

        agent_run.status = AgentRunStatus.COMPLETED
        agent_run.completed_at = timezone.now()
        agent_run.latency_ms = response.latency_ms
        agent_run.cost_usd = response.cost_usd
        agent_run.raw_response = response.raw
        agent_run.save()

        self.persist_output(ctx, response.data)

        AuditLogService.append(
            case=case,
            event_type=AuditEventType.AGENT_COMPLETED,
            actor=f"agent:{self.agent_key}",
            title=f"{self.display_name} completed",
            body=response.data.get("rationale", "")[:280] if isinstance(response.data, dict) else "",
            payload={
                "agent_key": self.agent_key,
                "synthetic": response.synthetic,
                "latency_ms": response.latency_ms,
                "output": response.data,
            },
        )

        return agent_run, response.data

    @abstractmethod
    def persist_output(self, ctx: AgentContext, data: dict[str, Any]) -> None:
        ...


def rng_for(seed: int) -> random.Random:
    return random.Random(seed)
