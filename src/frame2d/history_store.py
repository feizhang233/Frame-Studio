"""SQLite persistence for frontend model snapshots."""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE_PATH = PROJECT_ROOT / "data" / "frame2d.sqlite3"


class ModelHistoryStore:
    """Store and retrieve model snapshots from a small local SQLite database."""

    def __init__(self, database_path: str | Path | None = None) -> None:
        configured_path = database_path or os.environ.get("FRAME2D_DB_PATH")
        self.database_path = Path(configured_path or DEFAULT_DATABASE_PATH)

    def _connect(self) -> sqlite3.Connection:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.database_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout = 10000")
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS model_history (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                saved_at TEXT NOT NULL,
                source TEXT NOT NULL CHECK (source IN ('saved', 'analyzed')),
                model_json TEXT NOT NULL
            )
            """
        )
        return connection

    def list(self, limit: int = 12) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, name, saved_at, source, model_json
                FROM model_history
                ORDER BY saved_at DESC, rowid DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "savedAt": row["saved_at"],
                "source": row["source"],
                "model": json.loads(row["model_json"]),
            }
            for row in rows
        ]

    def save(self, entry: dict[str, Any]) -> dict[str, Any]:
        model_json = json.dumps(
            entry["model"], ensure_ascii=False, allow_nan=False, separators=(",", ":")
        )
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO model_history (id, name, saved_at, source, model_json)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    saved_at = excluded.saved_at,
                    source = excluded.source,
                    model_json = excluded.model_json
                """,
                (
                    entry["id"],
                    entry["name"],
                    entry["savedAt"],
                    entry["source"],
                    model_json,
                ),
            )
        return entry

    def delete(self, entry_id: str) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM model_history WHERE id = ?", (entry_id,)
            )
        return cursor.rowcount > 0

    def clear(self) -> int:
        """Delete all snapshots and return the number of removed rows."""
        with self._connect() as connection:
            cursor = connection.execute("DELETE FROM model_history")
        return cursor.rowcount
