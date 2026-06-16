"""Generic-OIDC-Flow via Authlib (Keycloak & andere OIDC-IdPs).

Env-basierte Konfiguration (OIDC_* in config.py). Sicherheit:
- ID-Token wird signatur-verifiziert gegen die Provider-JWKS (nicht
  ungeprüft dekodiert).
- iss / aud / exp / nonce werden geprüft (CSRF- + Replay-Schutz).
Discovery-Doc + JWKS werden je URL mit kurzem TTL gecacht.
"""

from __future__ import annotations

import logging
import time
from typing import Any
from urllib.parse import urlencode

import httpx
from authlib.jose import JsonWebKey
from authlib.jose import jwt as jose_jwt
from authlib.jose.errors import JoseError

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_DISCOVERY_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_JWKS_CACHE: dict[str, tuple[float, Any]] = {}
_TTL = 3600.0


class OidcError(RuntimeError):
    """OIDC-Flow-Fehler (Discovery, Token-Exchange, Verifikation)."""


def is_configured() -> bool:
    return bool(
        settings.oidc_discovery_url
        and settings.oidc_client_id
        and settings.oidc_redirect_uri
    )


def _well_known_url() -> str:
    url = (settings.oidc_discovery_url or "").rstrip("/")
    suffix = "/.well-known/openid-configuration"
    return url if url.endswith(suffix) else url + suffix


async def _get_discovery() -> dict[str, Any]:
    url = _well_known_url()
    now = time.time()
    cached = _DISCOVERY_CACHE.get(url)
    if cached and cached[0] > now:
        return cached[1]
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        doc = resp.json()
    for req in ("authorization_endpoint", "token_endpoint", "jwks_uri", "issuer"):
        if req not in doc:
            raise OidcError(f"Discovery-Dokument fehlt '{req}' ({url})")
    _DISCOVERY_CACHE[url] = (now + _TTL, doc)
    return doc


async def _get_jwks(jwks_uri: str, *, force: bool = False):
    now = time.time()
    cached = _JWKS_CACHE.get(jwks_uri)
    if cached and cached[0] > now and not force:
        return cached[1]
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(jwks_uri)
        resp.raise_for_status()
        key_set = JsonWebKey.import_key_set(resp.json())
    _JWKS_CACHE[jwks_uri] = (now + _TTL, key_set)
    return key_set


async def get_login_url(*, state: str, nonce: str) -> str:
    doc = await _get_discovery()
    params = {
        "client_id": settings.oidc_client_id,
        "response_type": "code",
        "redirect_uri": settings.oidc_redirect_uri,
        "scope": settings.oidc_scopes,
        "state": state,
        "nonce": nonce,
    }
    return f"{doc['authorization_endpoint']}?{urlencode(params)}"


async def exchange_code(code: str) -> dict[str, Any]:
    doc = await _get_discovery()
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.oidc_redirect_uri,
        "client_id": settings.oidc_client_id,
    }
    if settings.oidc_client_secret:
        data["client_secret"] = settings.oidc_client_secret
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            doc["token_endpoint"], data=data, headers={"Accept": "application/json"}
        )
    if resp.status_code >= 400:
        logger.error("OIDC token exchange failed (%s): %s", resp.status_code, resp.text[:300])
        raise OidcError(f"Token-Exchange fehlgeschlagen ({resp.status_code})")
    return resp.json()


async def decode_id_token(id_token: str, *, nonce: str | None = None) -> dict[str, Any]:
    doc = await _get_discovery()
    jwks_uri = doc["jwks_uri"]
    claims_options = {
        "iss": {"essential": True, "value": doc["issuer"]},
        "aud": {"essential": True, "value": settings.oidc_client_id},
        "exp": {"essential": True},
    }
    if nonce is not None:
        claims_options["nonce"] = {"essential": True, "value": nonce}

    async def _verify(force: bool):
        key_set = await _get_jwks(jwks_uri, force=force)
        claims = jose_jwt.decode(id_token, key_set, claims_options=claims_options)
        claims.validate()
        return dict(claims)

    try:
        return await _verify(False)
    except JoseError as e:
        logger.info("ID-Token-Verifikation 1. Versuch fehlgeschlagen (%s) — JWKS refetch", e)
        try:
            return await _verify(True)
        except JoseError as e2:
            raise OidcError("ID-Token-Verifikation fehlgeschlagen") from e2


def extract_groups(claims: dict[str, Any]) -> list[str]:
    raw = claims.get(settings.oidc_groups_claim)
    if raw is None:
        return []
    if isinstance(raw, str):
        return [raw]
    if isinstance(raw, (list, tuple)):
        return [str(g) for g in raw if g]
    return []


def resolve_role(claims: dict[str, Any], email: str) -> str:
    """Admin, wenn IdP-Gruppe in OIDC_ADMIN_GROUPS ODER E-Mail in ADMIN_EMAILS;
    sonst user."""
    groups = set(extract_groups(claims))
    if settings.admin_group_set & groups:
        return "admin"
    if email.lower() in settings.admin_email_set:
        return "admin"
    return "user"
