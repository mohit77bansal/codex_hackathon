from ninja import NinjaAPI

from apps.api.routers import agents as agents_router
from apps.api.routers import audit as audit_router
from apps.api.routers import cases as cases_router
from apps.api.routers import documents as documents_router
from apps.api.routers import insights as insights_router
from apps.api.routers import swarm as swarm_router

api = NinjaAPI(title="Decision Swarm OS", version="1.0")
api.add_router("/cases", cases_router.router)
api.add_router("/cases", swarm_router.router)
api.add_router("/cases", audit_router.router)
api.add_router("/cases", documents_router.router)
api.add_router("/samples", documents_router.samples_router)
api.add_router("/agents", agents_router.router)
api.add_router("/insights", insights_router.router)
