"""CRM API."""
from fastapi import APIRouter, BackgroundTasks
from src.db.schema import get_connection, insert_outcome
from src.connectors.base import normalize_owner_key
router = APIRouter(prefix="/api/v1/crm", tags=["crm"])

@router.post("/push")
async def push(bg: BackgroundTasks, min_tier: str = "B"):
    from src.orchestration.pipeline_bridge import run_ghl_export
    bg.add_task(run_ghl_export, min_tier)
    return {"status": "started", "minTier": min_tier}

@router.post("/webhooks/ghl")
async def ghl_webhook(payload: dict):
    from src.connectors.ghl import GHLConnector
    parsed = GHLConnector.process_webhook(payload)
    outcome = parsed.get("outcome_status", "")
    if not outcome: return {"status": "ignored"}
    name = payload.get("contact_name") or payload.get("contactName") or ""
    if name:
        with get_connection() as conn:
            p = conn.execute("SELECT id FROM prospects WHERE owner_key=?", (normalize_owner_key(name),)).fetchone()
            if p:
                insert_outcome(conn, p[0], outcome, parsed.get("ghl_contact_id",""), changed_by="ghl_webhook")
                return {"status": "recorded", "prospectId": p[0]}
    return {"status": "unmatched"}
