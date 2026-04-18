"""Analytics API."""
from fastapi import APIRouter
from src.db.schema import get_connection
router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])

@router.get("/overview")
async def overview():
    with get_connection() as conn:
        total = conn.execute("SELECT COUNT(*) FROM prospects WHERE is_deceased=0").fetchone()[0]
        wp = conn.execute("SELECT COUNT(*) FROM prospects WHERE phone IS NOT NULL AND phone!=''").fetchone()[0]
        we = conn.execute("SELECT COUNT(*) FROM prospects WHERE email IS NOT NULL AND email!=''").fetchone()[0]
        wa = conn.execute("SELECT COUNT(*) FROM prospects WHERE property_address IS NOT NULL AND LENGTH(property_address)>5").fetchone()[0]
        actionable = conn.execute("SELECT COUNT(*) FROM prospects WHERE is_deceased=0 AND ((phone IS NOT NULL AND phone!='') OR (email IS NOT NULL AND email!='') OR (property_address IS NOT NULL AND LENGTH(property_address)>5))").fetchone()[0]
        avg_s = conn.execute("SELECT AVG(propensity_score) FROM scores WHERE id IN (SELECT MAX(id) FROM scores GROUP BY prospect_id)").fetchone()[0] or 0
        total_ev = conn.execute("SELECT SUM(expected_value_usd) FROM scores WHERE id IN (SELECT MAX(id) FROM scores GROUP BY prospect_id)").fetchone()[0] or 0
        segs = conn.execute("SELECT segment, COUNT(*) FROM prospects WHERE is_deceased=0 GROUP BY segment").fetchall()
    return {"totalProspects": total, "totalActionable": actionable, "actionablePct": round(100*actionable/total,1) if total else 0,
        "avgPropensityScore": round(avg_s,1), "totalExpectedValue": round(total_ev,0),
        "totalWithPhone": wp, "totalWithEmail": we, "totalWithAddress": wa,
        "segments": {r[0]: r[1] for r in segs}}

@router.get("/funnel")
async def funnel():
    with get_connection() as conn:
        sourced = conn.execute("SELECT COUNT(*) FROM prospects").fetchone()[0]
        enriched = conn.execute("SELECT COUNT(DISTINCT prospect_id) FROM enrichment_log").fetchone()[0]
        scored = conn.execute("SELECT COUNT(DISTINCT prospect_id) FROM scores").fetchone()[0]
        exported = conn.execute("SELECT COUNT(DISTINCT prospect_id) FROM outcomes WHERE outcome_status!='not_contacted'").fetchone()[0]
        converted = conn.execute("SELECT COUNT(DISTINCT prospect_id) FROM outcomes WHERE outcome_status IN ('qualified','closed_won')").fetchone()[0]
    steps = [{"step":s,"count":c,"pct":round(100*c/sourced,1) if sourced else 0} for s,c in
        [("Sourced",sourced),("Enriched",enriched),("Scored",scored),("Exported",exported),("Converted",converted)]]
    return steps
