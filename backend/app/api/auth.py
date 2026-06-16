"""Auth API — OIDC login flow + token refresh."""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import (
    create_access_token,
    create_oidc_state_token,
    create_refresh_token,
    decode_token,
    random_token,
    verify_oidc_state_token,
)
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import (
    AuthConfigResponse,
    DevLoginRequest,
    OidcExchangeRequest,
    RefreshRequest,
    TokenResponse,
)
from app.services import oidc

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/config", response_model=AuthConfigResponse)
async def auth_config():
    """Öffentliche Info fürs Login-UI: welche Login-Methoden aktiv sind."""
    return AuthConfigResponse(
        oidc_enabled=oidc.is_configured(),
        oidc_label="Mit SSO anmelden",
        dev_login_enabled=settings.dev_login_enabled,
    )


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(request: DevLoginRequest, db: AsyncSession = Depends(get_db)):
    """Lokaler .env-basierter Login (ohne Keycloak).

    Nur aktiv, wenn DEV_LOGIN_ENABLED=true. Vergleicht Username/Passwort gegen
    den in der .env hinterlegten Benutzer (DEV_USER / DEV_PASSWORD). Für lokale
    Entwicklung gedacht — in Produktion OIDC nutzen und dies deaktiviert lassen.
    """
    import hmac

    if not settings.dev_login_enabled:
        raise HTTPException(404, "Dev-Login ist deaktiviert")
    if not settings.dev_password:
        raise HTTPException(500, "DEV_PASSWORD ist nicht gesetzt")

    # Konstantzeit-Vergleich gegen Timing-Angriffe.
    user_ok = hmac.compare_digest(
        request.username.strip().lower(), settings.dev_user.strip().lower()
    )
    pw_ok = hmac.compare_digest(request.password, settings.dev_password)
    if not (user_ok and pw_ok):
        raise HTTPException(401, "Benutzername oder Passwort falsch")

    username = settings.dev_user.strip()
    role = UserRole.ADMIN if settings.dev_user_role == "admin" else UserRole.USER
    # Synthetische E-Mail (die users-Tabelle verlangt eine eindeutige E-Mail).
    email = f"{username.lower()}@dev.local"

    user = await db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            username=username,
            role=role,
            full_name=username,
            first_name=username,
            settings={"dev_login": True},
        )
        db.add(user)
        await db.flush()
        logger.info("🆕 Dev-Login-User angelegt: %s (%s)", username, role.value)
    else:
        user.last_login = datetime.now(timezone.utc)
        user.role = role

    token_data = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/oidc/login")
async def oidc_login():
    """Startet den OIDC-Flow — liefert die Authorization-Redirect-URL."""
    if not oidc.is_configured():
        raise HTTPException(400, "OIDC ist nicht konfiguriert")
    nonce = random_token(24)
    state = create_oidc_state_token(nonce)
    try:
        url = await oidc.get_login_url(state=state, nonce=nonce)
    except oidc.OidcError as e:
        logger.error("OIDC login URL build failed: %s", e)
        raise HTTPException(502, "OIDC-Provider nicht erreichbar")
    return {"url": url}


@router.post("/oidc/token", response_model=TokenResponse)
async def oidc_token_exchange(
    request: OidcExchangeRequest, db: AsyncSession = Depends(get_db)
):
    """Tauscht den Authorization-Code gegen interne JWTs."""
    if not oidc.is_configured():
        raise HTTPException(400, "OIDC ist nicht konfiguriert")

    # State verifizieren → nonce binden (CSRF + Replay-Schutz).
    if not request.state:
        raise HTTPException(400, "Missing OIDC state")
    state_claims = verify_oidc_state_token(request.state)
    if not state_claims or not state_claims.get("nonce"):
        raise HTTPException(400, "Invalid OIDC state")
    nonce = state_claims["nonce"]

    try:
        tokens = await oidc.exchange_code(request.code)
        id_token = tokens.get("id_token")
        if not id_token:
            raise HTTPException(400, "No ID token returned")
        claims = await oidc.decode_id_token(id_token, nonce=nonce)
    except oidc.OidcError as e:
        logger.error("OIDC exchange failed: %s", e)
        raise HTTPException(401, "Authentifizierung fehlgeschlagen")

    subject = claims.get("sub")
    email = claims.get("email")
    if not subject:
        raise HTTPException(400, "OIDC token missing subject")
    if not email:
        raise HTTPException(400, "OIDC token missing email")
    if claims.get("email_verified") is not True:
        raise HTTPException(403, "E-Mail im IdP nicht verifiziert")

    username = claims.get("preferred_username") or email.split("@")[0]
    role_str = oidc.resolve_role(claims, email)

    # Find-or-create — primär über stabiles sub, dann verifizierte E-Mail.
    user = await db.scalar(select(User).where(User.oidc_subject == subject))
    if user is None:
        user = await db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            username=username,
            oidc_subject=subject,
            role=UserRole(role_str),
            first_name=claims.get("given_name"),
            last_name=claims.get("family_name"),
            full_name=claims.get("name"),
            settings={},
        )
        db.add(user)
        await db.flush()
        logger.info("🆕 Neuer OIDC-User: %s (%s)", username, role_str)
    else:
        user.oidc_subject = subject
        user.last_login = datetime.now(timezone.utc)
        if claims.get("given_name"):
            user.first_name = claims.get("given_name")
        if claims.get("family_name"):
            user.last_name = claims.get("family_name")
        if claims.get("name"):
            user.full_name = claims.get("name")
        # Rolle aktualisieren (Gruppen/Bootstrap maßgeblich).
        user.role = UserRole(role_str)

    token_data = {"sub": str(user.id), "role": user.role.value}
    access = create_access_token(token_data)
    refresh = create_refresh_token(token_data)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Erneuert das Access-Token über ein gültiges Refresh-Token."""
    payload = decode_token(request.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid refresh token")
    try:
        user_id = uuid.UUID(str(payload.get("sub")))
    except (ValueError, TypeError):
        raise HTTPException(401, "Invalid token subject")
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(401, "User not found / inactive")

    token_data = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        expires_in=settings.access_token_expire_minutes * 60,
    )
