"""Prospects API."""
from fastapi import APIRouter, Query
from src.db.schema import get_connection

router = APIRouter(prefix="/api/v1/prospects", tags=["prospects"])

@router.get("")
async def list_prospects(page: int = 1, page_size: int = 50, segment: str = None, tier: str = None,
                          sort_by: str = "expected_value_usd", sort_dir: str = "desc"):
    with get_connection() as conn:
        w, p = ["p.is_deceased=0 AND p.is_suppressed=0"], []
        if segment: w.append("p.segment=?"); p.append(segment)
        if tier: w.append("s.propensity_tier=?"); p.append(tier)
        wc = " AND ".join(w)
        allowed = {"propensity_score","expected_value_usd","last_updated_at","owner_name"}
        sc = sort_by if sort_by in allowed else "expected_value_usd"
        d = "DESC" if sort_dir=="desc" else "ASC"
        total = conn.execute(f"SELECT COUNT(*) FROM prospects p LEFT JOIN scores s ON s.prospect_id=p.id AND s.id=(SELECT MAX(id) FROM scores WHERE prospect_id=p.id) WHERE {wc}", p).fetchone()[0]
        rows = conn.execute(f"""SELECT p.*, s.propensity_score, s.propensity_tier, s.expected_value_usd
            FROM prospects p LEFT JOIN scores s ON s.prospect_id=p.id AND s.id=(SELECT MAX(id) FROM scores WHERE prospect_id=p.id)
            WHERE {wc} ORDER BY {sc} {d} NULLS LAST LIMIT ? OFFSET ?""", p + [page_size, (page-1)*page_size]).fetchall()
    return {"prospects": [dict(r) for r in rows], "total": total, "page": page, "pageSize": page_size}

@router.get("/search")
async def search(q: str = Query(..., min_length=2), limit: int = 20):
    with get_connection() as conn:
        like = f"%{q.upper()}%"
        rows = conn.execute("SELECT id, owner_key, owner_name, segment, phone, email FROM prospects WHERE UPPER(owner_name) LIKE ? OR UPPER(current_firm) LIKE ? LIMIT ?", (like, like, limit)).fetchall()
    return [dict(r) for r in rows]

@router.get("/segments")
async def segments():
    with get_connection() as conn:
        rows = conn.execute("""SELECT segment, COUNT(*) as total,
            SUM(CASE WHEN phone IS NOT NULL AND phone!='' THEN 1 ELSE 0 END) as withPhone,
            SUM(CASE WHEN email IS NOT NULL AND email!='' THEN 1 ELSE 0 END) as withEmail
            FROM prospects WHERE is_deceased=0 GROUP BY segment ORDER BY total DESC""").fetchall()
    return [dict(r) for r in rows]

@router.get("/{prospect_id}")
async def detail(prospect_id: int):
    with get_connection() as conn:
        p = conn.execute("SELECT * FROM prospects WHERE id=?", (prospect_id,)).fetchone()
        if not p: return {"error": "not found"}
        sr = conn.execute("SELECT * FROM source_records WHERE prospect_id=? ORDER BY ingested_at DESC", (prospect_id,)).fetchall()
        el = conn.execute("SELECT * FROM enrichment_log WHERE prospect_id=? ORDER BY enriched_at DESC", (prospect_id,)).fetchall()
        sc = conn.execute("SELECT * FROM scores WHERE prospect_id=? ORDER BY scored_at DESC LIMIT 10", (prospect_id,)).fetchall()
        oc = conn.execute("SELECT * FROM outcomes WHERE prospect_id=? ORDER BY changed_at DESC", (prospect_id,)).fetchall()
    return {"prospect": dict(p), "sourceRecords": [dict(s) for s in sr], "enrichmentLog": [dict(e) for e in el],
            "scoreHistory": [dict(s) for s in sc], "outcomes": [dict(o) for o in oc]}
