"""Pipeline API."""
import uuid
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks
from src.db.schema import get_connection
from src.db.schema import get_connection as app_conn

router = APIRouter(prefix="/api/v1/pipeline", tags=["pipeline"])

def _run_task(run_id, segment=None):
    from src.orchestration.pipeline_bridge import run_full_pipeline
    with app_conn() as conn:
        conn.execute("UPDATE pipeline_runs SET status='running' WHERE run_id=?", (run_id,))
    try:
        result = run_full_pipeline(segment=segment)
        with app_conn() as conn:
            conn.execute("UPDATE pipeline_runs SET status='completed', completed_at=?, total_enriched=?, total_scored=? WHERE run_id=?",
                (datetime.now().isoformat(), result.get("enrich",{}).get("enriched",0), result.get("score",{}).get("scored",0), run_id))
    except Exception as e:
        with app_conn() as conn:
            conn.execute("UPDATE pipeline_runs SET status='failed', completed_at=?, error_message=? WHERE run_id=?",
                (datetime.now().isoformat(), str(e), run_id))

@router.post("/run")
async def run(bg: BackgroundTasks, segment: str = None):
    run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    with app_conn() as conn:
        conn.execute("INSERT INTO pipeline_runs (run_id, status, started_at) VALUES (?, 'queued', ?)", (run_id, datetime.now().isoformat()))
    bg.add_task(_run_task, run_id, segment)
    return {"runId": run_id, "status": "queued"}

@router.get("/status")
async def status():
    with app_conn() as conn:
        row = conn.execute("SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 1").fetchone()
    if not row: return {"runId": "none", "status": "never_run", "startedAt": None}
    return dict(row)

@router.get("/history")
async def history(limit: int = 20):
    with app_conn() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT ?", (limit,)).fetchall()]
