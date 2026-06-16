"""Auth / user Pydantic schemas."""

import uuid

from pydantic import BaseModel, ConfigDict


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class OidcExchangeRequest(BaseModel):
    code: str
    state: str | None = None


class DevLoginRequest(BaseModel):
    username: str
    password: str


class AuthConfigResponse(BaseModel):
    # OIDC (Keycloak)
    oidc_enabled: bool
    oidc_label: str = "Mit SSO anmelden"
    # Dev-Login (.env-User)
    dev_login_enabled: bool = False


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # str statt EmailStr — Dev-Login-User dürfen reservierte Domains (.local)
    # tragen; echte OIDC-User werden bereits beim Login validiert.
    email: str
    username: str
    role: str
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None
