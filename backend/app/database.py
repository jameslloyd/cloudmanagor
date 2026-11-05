"""SQLite database management and persistence layer for CloudManager."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = Path(os.environ.get("CLOUDMANAGER_DB_PATH", str(DATA_DIR / "cloudmanager.db")))


def ensure_directories() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "templates").mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "exports").mkdir(parents=True, exist_ok=True)


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    ensure_directories()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS provider_connections (
                id TEXT PRIMARY KEY,
                provider_id TEXT NOT NULL,
                name TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'mock',
                credentials_json TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'connected',
                last_synced_at TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS metric_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_id TEXT NOT NULL,
                connection_id TEXT NOT NULL,
                domain TEXT NOT NULL,
                metric_name TEXT NOT NULL,
                metric_label TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT NOT NULL,
                recorded_at TEXT NOT NULL,
                dimensions_json TEXT NOT NULL DEFAULT '{}'
            );

            CREATE INDEX IF NOT EXISTS idx_metric_provider_domain_date
                ON metric_points(provider_id, domain, recorded_at);
            CREATE INDEX IF NOT EXISTS idx_metric_name_date
                ON metric_points(metric_name, recorded_at);

            CREATE TABLE IF NOT EXISTS insights (
                id TEXT PRIMARY KEY,
                provider_id TEXT NOT NULL,
                connection_id TEXT NOT NULL,
                domain TEXT NOT NULL,
                severity TEXT NOT NULL,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                recommendation TEXT NOT NULL,
                impact TEXT NOT NULL,
                estimated_savings_usd REAL NOT NULL DEFAULT 0.0,
                status TEXT NOT NULL DEFAULT 'open',
                detected_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_insights_provider_status
                ON insights(provider_id, status, severity);

            CREATE TABLE IF NOT EXISTS pptx_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                is_default INTEGER NOT NULL DEFAULT 0,
                placeholders_json TEXT NOT NULL DEFAULT '[]',
                slide_count INTEGER NOT NULL DEFAULT 0,
                layout_names_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS report_exports (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                subtitle TEXT NOT NULL,
                template_id TEXT,
                template_name TEXT NOT NULL,
                providers_json TEXT NOT NULL,
                domains_json TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                slide_count INTEGER NOT NULL DEFAULT 0,
                placeholders_replaced_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            );
            """
        )


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def list_connections() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM provider_connections ORDER BY created_at ASC"
        ).fetchall()
        results = []
        for r in rows:
            creds = json.loads(r["credentials_json"] or "{}")
            results.append(
                {
                    "id": r["id"],
                    "provider_id": r["provider_id"],
                    "name": r["name"],
                    "mode": r["mode"],
                    "status": r["status"],
                    "last_synced_at": r["last_synced_at"],
                    "created_at": r["created_at"],
                    "has_credentials": bool(any(str(v).strip() for v in creds.values())),
                }
            )
        return results


def get_connection(connection_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        r = conn.execute(
            "SELECT * FROM provider_connections WHERE id = ?", (connection_id,)
        ).fetchone()
        if not r:
            return None
        creds = json.loads(r["credentials_json"] or "{}")
        return {
            "id": r["id"],
            "provider_id": r["provider_id"],
            "name": r["name"],
            "mode": r["mode"],
            "credentials": creds,
            "status": r["status"],
            "last_synced_at": r["last_synced_at"],
            "created_at": r["created_at"],
            "has_credentials": bool(any(str(v).strip() for v in creds.values())),
        }


def create_connection(
    provider_id: str,
    name: str,
    mode: str = "mock",
    credentials: dict[str, Any] | None = None,
    conn_id: str | None = None,
) -> dict[str, Any]:
    cid = conn_id or f"conn-{provider_id}-{uuid.uuid4().hex[:8]}"
    created = now_iso()
    creds = credentials or {}
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO provider_connections (id, provider_id, name, mode, credentials_json, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (cid, provider_id, name, mode, json.dumps(creds), "connected", created),
        )
    return get_connection(cid)  # type: ignore[return-value]


def update_connection(
    connection_id: str,
    name: str | None = None,
    mode: str | None = None,
    credentials: dict[str, Any] | None = None,
    status: str | None = None,
    last_synced_at: str | None = None,
) -> dict[str, Any] | None:
    existing = get_connection(connection_id)
    if not existing:
        return None
    new_name = name if name is not None else existing["name"]
    new_mode = mode if mode is not None else existing["mode"]
    new_creds = credentials if credentials is not None else existing["credentials"]
    new_status = status if status is not None else existing["status"]
    new_synced = last_synced_at if last_synced_at is not None else existing["last_synced_at"]
    with get_db() as conn:
        conn.execute(
            """
            UPDATE provider_connections
            SET name = ?, mode = ?, credentials_json = ?, status = ?, last_synced_at = ?
            WHERE id = ?
            """,
            (new_name, new_mode, json.dumps(new_creds), new_status, new_synced, connection_id),
        )
    return get_connection(connection_id)


def delete_connection(connection_id: str) -> bool:
    with get_db() as conn:
        conn.execute("DELETE FROM metric_points WHERE connection_id = ?", (connection_id,))
        conn.execute("DELETE FROM insights WHERE connection_id = ?", (connection_id,))
        cur = conn.execute("DELETE FROM provider_connections WHERE id = ?", (connection_id,))
        return cur.rowcount > 0


def replace_connection_sync_data(
    connection_id: str,
    metrics: list[dict[str, Any]],
    insights: list[dict[str, Any]],
) -> tuple[int, int]:
    synced_time = now_iso()
    with get_db() as conn:
        # Preserve resolved/dismissed statuses by title for this connection
        existing_statuses = {
            row["title"]: row["status"]
            for row in conn.execute(
                "SELECT title, status FROM insights WHERE connection_id = ?",
                (connection_id,),
            ).fetchall()
        }
        conn.execute("DELETE FROM metric_points WHERE connection_id = ?", (connection_id,))
        conn.execute("DELETE FROM insights WHERE connection_id = ?", (connection_id,))

        for m in metrics:
            conn.execute(
                """
                INSERT INTO metric_points
                (provider_id, connection_id, domain, metric_name, metric_label, value, unit, recorded_at, dimensions_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    m["provider_id"],
                    connection_id,
                    m["domain"],
                    m["metric_name"],
                    m["metric_label"],
                    float(m["value"]),
                    m["unit"],
                    m["recorded_at"],
                    json.dumps(m.get("dimensions", {})),
                ),
            )

        for ins in insights:
            iid = ins.get("id") or f"ins-{uuid.uuid4().hex[:10]}"
            preserved_status = existing_statuses.get(ins["title"], ins.get("status", "open"))
            conn.execute(
                """
                INSERT INTO insights
                (id, provider_id, connection_id, domain, severity, title, summary, recommendation, impact, estimated_savings_usd, status, detected_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    iid,
                    ins["provider_id"],
                    connection_id,
                    ins["domain"],
                    ins["severity"],
                    ins["title"],
                    ins["summary"],
                    ins["recommendation"],
                    ins["impact"],
                    float(ins.get("estimated_savings_usd", 0.0)),
                    preserved_status,
                    ins.get("detected_at") or synced_time,
                ),
            )

        conn.execute(
            "UPDATE provider_connections SET last_synced_at = ?, status = 'connected' WHERE id = ?",
            (synced_time, connection_id),
        )
    return len(metrics), len(insights)
