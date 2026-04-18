"""
Webhook Receiver
==================
Lightweight HTTP server that receives callbacks from:
  - GHL (outcome_status changes, contact updates)
  - Calendly (meeting booked/cancelled)
  - Dripify (LinkedIn reply/connection)

Writes events directly to the DB outcomes table, closing the label loop
for Phase 1 training without manual CSV export.

In production: replace with FastAPI endpoint mounted in the app.
For standalone: run as a simple Flask/http.server process.

Usage:
  python webhook_receiver.py --port 8765

Endpoints:
  POST /webhooks/ghl        — GHL contact/opportunity updates
  POST /webhooks/calendly    — Calendly invitee events
  POST /webhooks/dripify     — Dripify lead events
  GET  /health               — health check
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from functools import partial
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.db.schema import init_db, get_connection, insert_outcome


class WebhookHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler for webhook endpoints."""

    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"status": "ok", "timestamp": datetime.now().isoformat()})
        else:
            self._respond(404, {"error": "not found"})

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len)
        try:
            payload = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self._respond(400, {"error": "invalid JSON"})
            return

        if self.path == "/webhooks/ghl":
            result = self._handle_ghl(payload)
        elif self.path == "/webhooks/calendly":
            result = self._handle_calendly(payload)
        elif self.path == "/webhooks/dripify":
            result = self._handle_dripify(payload)
        else:
            self._respond(404, {"error": "unknown endpoint"})
            return

        self._respond(200, result)

    def _handle_ghl(self, payload: dict) -> dict:
        """Process GHL webhook → write outcome to DB."""
        from src.connectors.ghl import GHLConnector
        parsed = GHLConnector.process_webhook(payload)
        ghl_id = parsed.get("ghl_contact_id", "")
        outcome = parsed.get("outcome_status", "")
        if not outcome:
            return {"status": "ignored", "reason": "no outcome_status"}

        with get_connection() as conn:
            # Find prospect by GHL contact ID or fall back to name match
            row = conn.execute(
                "SELECT id FROM source_records WHERE raw_data LIKE ? LIMIT 1",
                (f"%{ghl_id}%",)
            ).fetchone()
            pid = row[0] if row else None
            if not pid:
                # Try matching by contact name in the raw payload
                contact_name = payload.get("contact_name") or payload.get("contactName") or ""
                if contact_name:
                    from src.connectors.base import normalize_owner_key
                    key = normalize_owner_key(contact_name)
                    prospect = conn.execute(
                        "SELECT id FROM prospects WHERE owner_key = ?", (key,)
                    ).fetchone()
                    pid = prospect[0] if prospect else None

            if pid:
                # Get current score for snapshot
                score_row = conn.execute(
                    "SELECT propensity_score FROM scores WHERE prospect_id = ? "
                    "ORDER BY scored_at DESC LIMIT 1", (pid,)
                ).fetchone()
                score_at = score_row[0] if score_row else None
                insert_outcome(conn, pid, outcome, ghl_id, score_at, "ghl_webhook")
                return {"status": "recorded", "prospect_id": pid, "outcome": outcome}
            else:
                return {"status": "unmatched", "ghl_contact_id": ghl_id,
                        "reason": "no matching prospect in DB"}

    def _handle_calendly(self, payload: dict) -> dict:
        """Process Calendly webhook — meeting booked = engagement signal."""
        event_type = payload.get("event", "")
        invitee = payload.get("payload", {}).get("invitee", {})
        email = invitee.get("email", "")
        name = invitee.get("name", "")

        if not email and not name:
            return {"status": "ignored", "reason": "no invitee data"}

        with get_connection() as conn:
            # Match by email first, then name
            prospect = None
            if email:
                prospect = conn.execute(
                    "SELECT id FROM prospects WHERE email = ?", (email,)
                ).fetchone()
            if not prospect and name:
                from src.connectors.base import normalize_owner_key
                key = normalize_owner_key(name)
                prospect = conn.execute(
                    "SELECT id FROM prospects WHERE owner_key = ?", (key,)
                ).fetchone()
            if prospect:
                outcome = "responded" if "created" in event_type else "contacted"
                insert_outcome(conn, prospect[0], outcome, changed_by="calendly_webhook")
                return {"status": "recorded", "prospect_id": prospect[0], "event": event_type}
        return {"status": "unmatched", "email": email}

    def _handle_dripify(self, payload: dict) -> dict:
        """Process Dripify webhook — LinkedIn reply = engagement signal."""
        lead_name = payload.get("lead_name") or payload.get("name", "")
        event_type = payload.get("event_type", "")

        if not lead_name:
            return {"status": "ignored", "reason": "no lead data"}

        with get_connection() as conn:
            from src.connectors.base import normalize_owner_key
            key = normalize_owner_key(lead_name)
            prospect = conn.execute(
                "SELECT id FROM prospects WHERE owner_key = ?", (key,)
            ).fetchone()
            if prospect:
                outcome_map = {"replied": "responded", "connected": "contacted",
                               "email_found": "contacted"}
                outcome = outcome_map.get(event_type, "contacted")
                insert_outcome(conn, prospect[0], outcome, changed_by="dripify_webhook")
                return {"status": "recorded", "prospect_id": prospect[0], "event": event_type}
        return {"status": "unmatched", "lead_name": lead_name}

    def _respond(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def log_message(self, format, *args):
        """Quieter logging."""
        print(f"[webhook] {self.client_address[0]} {format % args}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", type=str, default="0.0.0.0")
    args = ap.parse_args()

    init_db()
    server = HTTPServer((args.host, args.port), WebhookHandler)
    print(f"[webhook] listening on {args.host}:{args.port}")
    print(f"  POST /webhooks/ghl      — GHL outcome updates")
    print(f"  POST /webhooks/calendly  — Calendly invitee events")
    print(f"  POST /webhooks/dripify   — Dripify lead events")
    print(f"  GET  /health             — health check")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[webhook] shutting down")
        server.server_close()


if __name__ == "__main__":
    main()
