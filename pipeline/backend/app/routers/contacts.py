"""Contacts API."""
from fastapi import APIRouter, BackgroundTasks
from src.db.schema import get_connection
router = APIRouter(prefix="/api/v1/contacts", tags=["contacts"])

@router.get("/completeness")
async def completeness():
    with get_connection() as conn:
        rows = conn.execute("""SELECT segment, COUNT(*) as total,
            SUM(CASE WHEN phone IS NOT NULL AND phone!='' THEN 1 ELSE 0 END) as withPhone,
            SUM(CASE WHEN email IS NOT NULL AND email!='' THEN 1 ELSE 0 END) as withEmail,
            SUM(CASE WHEN property_address IS NOT NULL AND LENGTH(property_address)>5 THEN 1 ELSE 0 END) as withAddress
            FROM prospects WHERE is_deceased=0 GROUP BY segment""").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["phonePct"] = round(100*d["withPhone"]/d["total"],1) if d["total"] else 0
        d["emailPct"] = round(100*d["withEmail"]/d["total"],1) if d["total"] else 0
        result.append(d)
    return result

@router.post("/enrich")
async def enrich(bg: BackgroundTasks, tier: str = "T0"):
    from src.enrichment.contact_enrichment import run_contact_enrichment
    bg.add_task(run_contact_enrichment, tier)
    return {"status": "started", "tier": tier}
