[![Demo Video](https://img.youtube.com/vi/VIDEO_ID/0.jpg)]([https://www.youtube.com/watch?v=VIDEO_ID](https://youtu.be/NzLYz-x1Hac))

# Decision Swarm OS — Credit Underwriting

A real, working implementation of the "Decision Swarm OS" concept from
[Swarm_Explainer_Reframed.html](Swarm_Explainer_Reframed.html): six specialist
agents debate a credit case, a Lead Reviewer reframes the tradeoff, and a
Final Governor issues an accountable, audit-chained verdict.

The demo runs entirely offline (synthetic LLM fallback) and lights up with real
OpenAI calls the moment you provide an `OPENAI_API_KEY`.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  React + Framer Motion  (localhost:5173)                        │
│  Overview · Queue · Intake · Decision Theatre · Audit Ledger    │
└─────────┬───────────────────────────────────────────────────────┘
          │  /api/cases/*  · /api/cases/:id/run/ · /audit/
┌─────────▼───────────────────────────────────────────────────────┐
│  Django 6 + Django Ninja + Pydantic v2  (localhost:8000)        │
│                                                                 │
│  ┌── Specialists ─────────────────┐   ┌── Orchestrators ──────┐ │
│  │  Bureau Score Agent            │   │  Lead Reviewer        │ │
│  │  Bank Statement Agent          │   │   (reconciles)        │ │
│  │  Fraud Detection Agent         │   │                       │ │
│  │  Income Verification Agent     │   │  Final Governor       │ │
│  │  Policy Agent (hybrid rules)   │   │   (decides + logs)    │ │
│  │  Behavioural Agent             │   └───────────────────────┘ │
│  └────────────────────────────────┘                             │
│                                                                 │
│  Audit ledger: append-only, hash-chained, verify endpoint       │
│  LLM client: OpenAI structured output + deterministic fallback  │
└─────────────────────────────────────────────────────────────────┘
```

- **Specialists** pre-process deterministic features (DSCR, DPD buckets, HHI,
  etc.) then ask an LLM for a structured `SpecialistPosition`.
- **Policy Agent** is hybrid — a YAML rule engine decides stance, the LLM only
  narrates rationale, so policy cannot be silently overridden.
- **Lead Reviewer** reads all 6 positions + a conflict matrix and reframes the
  real tradeoff, emitting meters for uncertainty / conflict / pressure /
  reversibility.
- **Final Governor** produces the accountable verdict with confidence,
  constraint fit, audit strength, conditions, and review checkpoints.
- **Audit ledger** is append-only at the app level with a SHA-256 chain
  (`prev_hash → row_hash`). Frontend shows a "chain verified" badge.

## Repository layout

```
codex_hackathon/
  backend/                         # Django project
    swarm_os/                      # settings, urls, celery, wsgi, asgi
    apps/
      cases/                       # Case, Applicant, FinancialData, ...
      swarm/                       # AgentRun, AgentPosition, Debate, FinalDecision
      audit/                       # AuditLogEntry + AuditLogService
      agents/                      # base + specialists + orchestrators + schemas + features
      policy/                      # YAML policy + deterministic rule engine
      orchestration/               # sync runner + celery wrapper + SSE publisher
      llm/                         # OpenAI structured-output client
      api/                         # Ninja routers
    manage.py
    requirements.txt
  frontend/                        # React 18 + Vite + TS + Framer Motion + Tailwind
    src/
      components/
        common/                    # Shell (sidebar), TopBar
        theatre/                   # AgentCard, ConsensusHub (gauge), LeadPanel,
                                   # DecisionCard, ReasoningStream, AuditStream
      pages/                       # Overview, CaseQueue, CaseIntake, CaseTheatre
      hooks/                       # useSwarmStream (SSE) — falls back to polling
      store/                       # Zustand theatre store
      api/                         # typed fetch client
      lib/                         # types, motion tokens, formatters
  Swarm_Explainer_Reframed.html    # product explainer (design reference)
  motion_design_prompt.md          # motion language used for the theatre
```

## Prerequisites

- macOS / Linux
- Node 20+
- Python 3.13 (or any 3.11+) with Conda / a virtualenv
- (Optional) OpenAI API key — without it, the pipeline uses deterministic synthetic responses

## Backend setup

```bash
# From repo root
conda activate codex_hackathon_venv   # or create a fresh one with python 3.13
pip install -r backend/requirements.txt

cd backend
python manage.py makemigrations cases swarm audit
python manage.py migrate
python manage.py seed_cases --count 8
python manage.py runserver 0.0.0.0:8000
```

## Frontend setup

```bash
cd frontend
npm install
npm run dev
# open http://localhost:5173
```

Vite proxies `/api` → `http://localhost:8000` so you don't need CORS setup.

## Using the app

1. Open **http://localhost:5173/queue** and click **"Seed 8 synthetic cases"**
   (or use **"New case"** to create one from scratch).
2. Click any case card to open the **Decision Theatre**.
3. Hit **"Run swarm"**. Watch specialists light up, the consensus gauge swing,
   the lead reframe the tradeoff, and the governor issue a verdict.
4. Scroll down to see the live **audit ledger** with a "chain verified" badge.
5. If you want to override the verdict, click **"Override verdict"** on a
   decided case — a new decision is written, superseding the old one, and the
   override is logged.

## Environment variables

Copy these into `backend/.env` (read by `python-decouple`):

```
OPENAI_API_KEY=                            # leave empty for synthetic mode
OPENAI_MODEL_SPECIALIST=gpt-4o-mini
OPENAI_MODEL_ORCHESTRATOR=gpt-4o
SWARM_SYNTHETIC_MODE=True                  # set False once key is set
CELERY_TASK_ALWAYS_EAGER=True              # flip once you run a worker
DJANGO_DEBUG=True
```

## Swapping in real OpenAI

1. Set `OPENAI_API_KEY=sk-...` and `SWARM_SYNTHETIC_MODE=False`.
2. Restart Django.
3. Run a case — every call goes through `apps/llm/client.py:call_structured`,
   which validates the response against a Pydantic schema and falls back to
   synthetic on any failure so the UI never breaks.

## Production checklist (not needed for demo)

- [ ] Postgres via `DATABASE_URL` (swap DB trigger in for absolute audit
      immutability)
- [ ] Redis + Celery worker (flip `CELERY_TASK_ALWAYS_EAGER=False`)
- [ ] Proper SSE via django-channels (current stub uses polling)
- [ ] `django-allauth` + roles: `underwriter`, `senior_underwriter`, `auditor`
- [ ] Eval harness: replay N labeled cases, measure stance-stability on reruns
- [ ] Playwright E2E covering intake → run → override

## Source references

- Product narrative + visual DNA: `Swarm_Explainer_Reframed.html`
- Motion language for the theatre: `motion_design_prompt.md`
- Specialist list, pre-processing, LLM prompts: `backend/apps/agents/specialists.py`
- Lead + governor logic: `backend/apps/agents/orchestrators.py`
- Credit policy: `backend/apps/policy/credit_policy_v1.yaml` + `engine.py`
- Hash-chain audit: `backend/apps/audit/models.py::AuditLogService`
- Motion-rich theatre: `frontend/src/components/theatre/*`
