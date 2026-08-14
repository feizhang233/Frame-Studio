"""Identity and session persistence for Frame Studio."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any, Callable, Iterator

from .history_store import DEFAULT_DATABASE_URL, parse_mysql_database_url, pymysql


ConnectionFactory = Callable[..., Any]
PASSWORD_SCHEME = "scrypt"
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SESSION_TTL_DAYS = 30


class DuplicateEmailError(ValueError):
    """Raised when a registration email already belongs to an account."""


def normalize_email(email: str) -> str:
    """Return the canonical form used for account lookup."""
    return email.strip().casefold()


def hash_password(password: str) -> str:
    """Hash a password with a random salt using the stdlib scrypt KDF."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=32,
    )
    encoded_salt = base64.urlsafe_b64encode(salt).decode("ascii")
    encoded_digest = base64.urlsafe_b64encode(digest).decode("ascii")
    return (
        f"{PASSWORD_SCHEME}${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}"
        f"${encoded_salt}${encoded_digest}"
    )


def verify_password(password: str, encoded: str) -> bool:
    """Verify a password without leaking comparison timing."""
    try:
        scheme, raw_n, raw_r, raw_p, raw_salt, raw_digest = encoded.split("$", 5)
        if scheme != PASSWORD_SCHEME:
            return False
        salt = base64.urlsafe_b64decode(raw_salt.encode("ascii"))
        expected = base64.urlsafe_b64decode(raw_digest.encode("ascii"))
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(raw_n),
            r=int(raw_r),
            p=int(raw_p),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def _session_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def _iso_utc(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class AuthStore:
    """Create users and manage opaque, revocable login sessions in MySQL."""

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
                    "PyMySQL is required for IAM storage. Install the project "
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
                CREATE TABLE IF NOT EXISTS users (
                    id CHAR(32) PRIMARY KEY,
                    email VARCHAR(320) NOT NULL,
                    display_name VARCHAR(120) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    UNIQUE INDEX uq_users_email (email)
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS user_sessions (
                    token_hash CHAR(64) PRIMARY KEY,
                    user_id CHAR(32) NOT NULL,
                    expires_at DATETIME(6) NOT NULL,
                    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    last_used_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    INDEX idx_user_sessions_user (user_id),
                    INDEX idx_user_sessions_expiry (expires_at),
                    CONSTRAINT fk_user_sessions_user
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
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

    @staticmethod
    def _public_user(row: dict[str, Any]) -> dict[str, str]:
        return {
            "id": row["id"],
            "email": row["email"],
            "displayName": row["display_name"],
            "createdAt": _iso_utc(row["created_at"]),
        }

    def register(self, email: str, display_name: str, password: str) -> dict[str, str]:
        user_id = uuid.uuid4().hex
        canonical_email = normalize_email(email)
        created_at = datetime.now(UTC)
        try:
            with self._connection() as connection, connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO users (id, email, display_name, password_hash, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        canonical_email,
                        display_name.strip(),
                        hash_password(password),
                        created_at.replace(tzinfo=None),
                    ),
                )
                connection.commit()
        except Exception as exception:
            if getattr(exception, "args", (None,))[0] == 1062:
                raise DuplicateEmailError("An account with this email already exists") from exception
            raise
        return {
            "id": user_id,
            "email": canonical_email,
            "displayName": display_name.strip(),
            "createdAt": _iso_utc(created_at),
        }

    def authenticate(self, email: str, password: str) -> dict[str, str] | None:
        canonical_email = normalize_email(email)
        with self._connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, email, display_name, password_hash, created_at
                FROM users
                WHERE email = %s
                """,
                (canonical_email,),
            )
            row = cursor.fetchone()
        if not row or not verify_password(password, row["password_hash"]):
            return None
        return self._public_user(row)

    def create_session(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(days=SESSION_TTL_DAYS)
        with self._connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO user_sessions (token_hash, user_id, expires_at)
                VALUES (%s, %s, %s)
                """,
                (_session_token_hash(token), user_id, expires_at.replace(tzinfo=None)),
            )
            cursor.execute("DELETE FROM user_sessions WHERE expires_at <= UTC_TIMESTAMP(6)")
            connection.commit()
        return token

    def user_for_session(self, token: str) -> dict[str, str] | None:
        with self._connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT users.id, users.email, users.display_name, users.created_at
                FROM user_sessions
                INNER JOIN users ON users.id = user_sessions.user_id
                WHERE user_sessions.token_hash = %s
                  AND user_sessions.expires_at > UTC_TIMESTAMP(6)
                """,
                (_session_token_hash(token),),
            )
            row = cursor.fetchone()
            if row:
                cursor.execute(
                    """
                    UPDATE user_sessions SET last_used_at = CURRENT_TIMESTAMP(6)
                    WHERE token_hash = %s
                    """,
                    (_session_token_hash(token),),
                )
                connection.commit()
        return self._public_user(row) if row else None

    def delete_session(self, token: str) -> None:
        with self._connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM user_sessions WHERE token_hash = %s",
                (_session_token_hash(token),),
            )
            connection.commit()
