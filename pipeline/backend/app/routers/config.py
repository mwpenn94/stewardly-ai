"""Config API."""
import yaml, os
from pathlib import Path
from fastapi import APIRouter
router = APIRouter(prefix="/api/v1/config", tags=["config"])
CONFIG = Path(os.environ.get("WB_CONFIG_PATH", "./pipeline/config.example.yaml"))

@router.get("")
async def get_config():
    if CONFIG.exists():
        with open(CONFIG) as f: return yaml.safe_load(f)
    return {"error": "config not found"}

@router.patch("")
async def update_config(updates: dict):
    if not CONFIG.exists(): return {"error": "config not found"}
    with open(CONFIG) as f: current = yaml.safe_load(f)
    def merge(base, over):
        for k, v in over.items():
            if isinstance(v, dict) and isinstance(base.get(k), dict): merge(base[k], v)
            else: base[k] = v
    merge(current, updates)
    with open(CONFIG, "w") as f: yaml.dump(current, f, default_flow_style=False)
    return {"status": "updated"}
