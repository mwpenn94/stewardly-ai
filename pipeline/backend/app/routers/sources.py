"""Sources API."""
import shutil
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, File, UploadFile
from src.connectors.base import SOURCE_REGISTRY
from src.db.schema import get_connection

router = APIRouter(prefix="/api/v1/sources", tags=["sources"])

@router.get("")
async def list_sources():
    results = []
    with get_connection() as conn:
        for stype, entry in SOURCE_REGISTRY.items():
            last = conn.execute("SELECT sync_completed_at, status FROM sync_log WHERE source_type = ? ORDER BY sync_completed_at DESC LIMIT 1", (stype,)).fetchone()
            total = conn.execute("SELECT COUNT(*) FROM source_records WHERE source_type = ?", (stype,)).fetchone()
            results.append({"sourceType": stype, "sourceName": entry.get("class", stype), "enabled": entry.get("enabled", False),
                "lastSync": last[0] if last else None, "lastSyncStatus": last[1] if last else None,
                "recordsTotal": total[0] if total else 0, "requiresApiKey": "api_key" in str(entry.get("config", {})),
                "isConfigured": entry.get("enabled", False), "tier": "T0"})
    return results

@router.post("/{source_type}/sync")
async def sync_source(source_type: str, bg: BackgroundTasks, full: bool = False):
    from src.connectors.ingestion_engine import ingest_source
    bg.add_task(ingest_source, source_type, full)
    return {"status": "started", "sourceType": source_type}

@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    dest = Path("./pipeline/data/raw") / file.filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"status": "uploaded", "filename": file.filename}
