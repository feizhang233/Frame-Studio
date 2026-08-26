"""MySQL persistence for frontend model snapshots."""

from __future__ import annotations

import json
import os
from contextlib import contextmanager
from typing import Any, Callable, Iterator, Literal
from urllib.parse import parse_qs, unquote, urlparse

try:
    import pymysql
except ModuleNotFoundError:  # The project dependency provides this in deployed environments.
    pymysql = None


DEFAULT_DATABASE_URL = "mysql://frame2d:frame2d@127.0.0.1:3307/frame2d"
HistorySource = Literal["saved", "analyzed"]
ConnectionFactory = Callable[..., Any]


def parse_mysql_database_url(database_url: str) -> dict[str, Any]:
    """Convert a mysql:// URL into safe PyMySQL connection arguments."""
    parsed = urlparse(database_url)
    if parsed.scheme not in {"mysql", "mysql+pymysql"}:
        raise ValueError(
            "FRAME2D_DATABASE_URL must use mysql:// or mysql+pymysql://"
        )
    database = unquote(parsed.path.lstrip("/"))
    if not parsed.hostname or not database:
        raise ValueError("MySQL URL must include a hostname and database name")

    query = parse_qs(parsed.query)
    connect_timeout = int(query.get("connect_timeout", ["10"])[0])
    return {
        "host": parsed.hostname,
        "port": parsed.port or 3306,
        "user": unquote(parsed.username or ""),
        "password": unquote(parsed.password or ""),
        "database": database,
        "charset": query.get("charset", ["utf8mb4"])[0],
        "connect_timeout": connect_timeout,
        "autocommit": False,
    }


class ModelHistoryStore:
    """Store and retrieve user-owned model snapshots from MySQL."""

    def __init__(
        self,
        database_url: str | None = None,
        *,
        connection_factory: ConnectionFactory | None = None,
    ) -> None:
        self.database_url = (
            database_url
            or os.environ.get("FRAME2D_DATABASE_URL")
            or DEFAULT_DATABASE_URL
        )
        self.connection_options = parse_mysql_database_url(self.database_url)
        self._connection_factory = connection_factory

    def _connect(self) -> Any:
        factory = self._connection_factory
        if factory is None:
            if pymysql is None:
                raise RuntimeError(
                    "PyMySQL is required for model storage. Install the project "
                    "dependencies before starting the API."
                )
            factory = pymysql.connect

        options = dict(self.connection_options)
        if pymysql is not None:
            options["cursorclass"] = pymysql.cursors.DictCursor
        connection = factory(**options)
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS model_history (
                    user_id CHAR(32) NOT NULL,
                    id VARCHAR(160) NOT NULL,
                    name VARCHAR(300) NOT NULL,
                    saved_at VARCHAR(80) NOT NULL,
                    source ENUM('saved', 'analyzed') NOT NULL,
                    model_json JSON NOT NULL,
                    updated_at TIMESTAMP(6) NOT NULL
                        DEFAULT CURRENT_TIMESTAMP(6)
                        ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (user_id, id),
                    INDEX idx_model_history_user_saved (user_id, saved_at, updated_at),
                    INDEX idx_model_history_saved_at (saved_at, updated_at),
                    INDEX idx_model_history_source (source)
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
                """
            )
            # Upgrade databases created before IAM. Legacy rows deliberately remain
            # inaccessible instead of being exposed to the first registered user.
            cursor.execute("SHOW COLUMNS FROM model_history LIKE 'user_id'")
            if cursor.fetchone() is None:
                cursor.execute(
                    "ALTER TABLE model_history ADD COLUMN user_id CHAR(32) NULL FIRST"
                )
            cursor.execute(
                "UPDATE model_history SET user_id = 'legacy' WHERE user_id IS NULL"
            )
            cursor.execute(
                "SHOW INDEX FROM model_history WHERE Key_name = 'PRIMARY'"
            )
            primary_columns = [
                row["Column_name"]
                for row in sorted(cursor.fetchall(), key=lambda row: row["Seq_in_index"])
            ]
            if primary_columns != ["user_id", "id"]:
                cursor.execute(
                    """
                    ALTER TABLE model_history
                        DROP PRIMARY KEY,
                        MODIFY user_id CHAR(32) NOT NULL,
                        ADD PRIMARY KEY (user_id, id)
                    """
                )
            cursor.execute(
                "SHOW INDEX FROM model_history "
                "WHERE Key_name = 'idx_model_history_user_saved'"
            )
            if cursor.fetchone() is None:
                cursor.execute(
                    """
                    ALTER TABLE model_history
                    ADD INDEX idx_model_history_user_saved
                        (user_id, saved_at, updated_at)
                    """
                )
        connection.commit()
        return connection

    @contextmanager
    def _connection(self) -> Iterator[Any]:
        connection = self._connect()
        try:
            yield connection
        finally:
            connection.close()

    def list(self, user_id: str, limit: int = 12) -> list[dict[str, Any]]:
        with self._connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, saved_at, source, model_json
                FROM model_history
                WHERE user_id = %s
                ORDER BY saved_at DESC, updated_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            rows = cursor.fetchall()
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "savedAt": row["saved_at"],
                "source": row["source"],
                "model": (
                    row["model_json"]
                    if isinstance(row["model_json"], dict)
                    else json.loads(row["model_json"])
                ),
            }
            for row in rows
        ]

    def save(self, user_id: str, entry: dict[str, Any]) -> dict[str, Any]:
        model_json = json.dumps(
            entry["model"], ensure_ascii=False, allow_nan=False, separators=(",", ":")
        )
        with self._connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO model_history
                    (user_id, id, name, saved_at, source, model_json)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    saved_at = VALUES(saved_at),
                    source = VALUES(source),
                    model_json = VALUES(model_json)
                """,
                (
                    user_id,
                    entry["id"],
                    entry["name"],
                    entry["savedAt"],
                    entry["source"],
                    model_json,
                ),
            )
            connection.commit()
        return entry

    def delete(self, user_id: str, entry_id: str) -> bool:
        with self._connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM model_history WHERE user_id = %s AND id = %s",
                (user_id, entry_id),
            )
            connection.commit()
            return cursor.rowcount > 0

    def clear(self, user_id: str, source: HistorySource | None = None) -> int:
        """Delete snapshots, optionally restricted to one source."""
        with self._connection() as connection, connection.cursor() as cursor:
            if source is None:
                cursor.execute(
                    "DELETE FROM model_history WHERE user_id = %s", (user_id,)
                )
            else:
                cursor.execute(
                    "DELETE FROM model_history WHERE user_id = %s AND source = %s",
                    (user_id, source),
                )
            connection.commit()
            return cursor.rowcount
