"""Scores API."""
from fastapi import APIRouter
from src.db.schema import get_connection
router = APIRouter(prefix="/api/v1/scores", tags=["scores"])

@router.get("/latest")
async def latest():
    with get_connection() as conn:
        run = conn.execute("SELECT scoring_run_id, scored_at FROM scores ORDER BY scored_at DESC LIMIT 1").fetchone()
        if not run: return {"status": "no scores"}
        rows = conn.execute("""SELECT segment, COUNT(*) as total, MIN(propensity_score) as scoreMin, AVG(propensity_score) as scoreAvg,
            MAX(propensity_score) as scoreMax, SUM(CASE WHEN propensity_tier='A' THEN 1 ELSE 0 END) as tierA,
            SUM(CASE WHEN propensity_tier='B' THEN 1 ELSE 0 END) as tierB, SUM(CASE WHEN propensity_tier='C' THEN 1 ELSE 0 END) as tierC,
            SUM(CASE WHEN propensity_tier='D' THEN 1 ELSE 0 END) as tierD, SUM(expected_value_usd) as totalEv
            FROM scores WHERE scoring_run_id=? GROUP BY segment""", (run[0],)).fetchall()
    return {"runId": run[0], "scoredAt": run[1], "segments": [dict(r) for r in rows]}

@router.get("/distribution")
async def distribution():
    with get_connection() as conn:
        rows = conn.execute("""SELECT s.segment, s.propensity_score, s.propensity_tier, s.expected_value_usd
            FROM scores s WHERE s.id IN (SELECT MAX(id) FROM scores GROUP BY prospect_id)
            ORDER BY s.segment, s.propensity_score""").fetchall()
    return [dict(r) for r in rows]
