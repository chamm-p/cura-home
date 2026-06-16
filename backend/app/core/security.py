"""Security utilities — JWT tokens, OIDC state tokens, Fernet encryption.

cura-home authentifiziert ausschließlich via OIDC (kein lokales Passwort),
daher gibt es hier kein Passwort-Hashing — nur die Token- und Krypto-Helfer,
die der OIDC-Flow und die verschlüsselte Ablage von LLM-API-Keys brauchen.
"""

import secrets
from datetime import datetime, timedelta, timezone

from cryptography.fernet import Fernet
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()


# ─── JWT (Access / Refresh) ───
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.refresh_token_expire_days)
    )
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(
            token, settings.secret_key, algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        return None


# ─── OIDC State/Nonce-Token ───
# Kein Server-Side-Session-Store: wir signieren einen kurzlebigen State-Token
# mit secret_key, der das nonce trägt (CSRF + ID-Token-Replay-Schutz).
def create_oidc_state_token(nonce: str, expires_in_seconds: int = 600) -> str:
    expire = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)
    return jwt.encode(
        {"nonce": nonce, "exp": expire, "type": "oidc_state"},
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )


def verify_oidc_state_token(token: str) -> dict | None:
    payload = decode_token(token)
    if not payload or payload.get("type") != "oidc_state":
        return None
    return payload


# ─── Fernet Encryption (für gespeicherte LLM-API-Keys) ───
class EncryptionKeyError(RuntimeError):
    """ENCRYPTION_KEY fehlt, ist Platzhalter oder kein gültiger Fernet-Key."""


def validate_secrets() -> None:
    """Startup-Check: SECRET_KEY und ENCRYPTION_KEY müssen gesetzt & gültig
    sein. Lieber laut beim Start scheitern als still mitten im Flow."""
    sk = settings.secret_key or ""
    if sk in {"", "CHANGE_ME", "changeme", "secret"} or len(sk) < 32:
        raise EncryptionKeyError(
            "SECRET_KEY fehlt/zu kurz (min. 32 Zeichen). Erzeuge einen mit:\n"
            '  python3 -c "import secrets; print(secrets.token_hex(32))"'
        )
    key = settings.encryption_key
    if not key or key in {"CHANGE_ME", "changeme"}:
        raise EncryptionKeyError(
            "ENCRYPTION_KEY fehlt. Erzeuge einen Fernet-Key mit:\n"
            '  python3 -c "import os,base64; '
            'print(base64.urlsafe_b64encode(os.urandom(32)).decode())"'
        )
    try:
        Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as e:  # noqa: BLE001
        raise EncryptionKeyError(
            f"ENCRYPTION_KEY ist kein gültiger Fernet-Key ({e}). "
            "Er muss 32 url-safe base64-Bytes sein (44 Zeichen, endet auf '=')."
        ) from e


def get_fernet() -> Fernet:
    key = settings.encryption_key
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(value: str) -> str:
    return get_fernet().encrypt(value.encode()).decode()


def decrypt_value(encrypted_value: str) -> str:
    return get_fernet().decrypt(encrypted_value.encode()).decode()


def random_token(n: int = 24) -> str:
    return secrets.token_urlsafe(n)
