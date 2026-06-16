"""cura-home — Application configuration."""

from functools import lru_cache

from dotenv import load_dotenv
from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class Settings(BaseSettings):
    """Settings loaded from environment / .env."""

    # ─── App ───
    app_name: str = "cura-home"
    app_version: str = "0.1.0"
    debug: bool = False
    # Öffentliche Basis-URL des Frontends — u.a. QR-Code-Ziel (…/items/{id}).
    public_base_url: str = Field(default="http://localhost:9601")
    uploads_dir: str = Field(default="/app/uploads")

    # ─── Database ───
    database_url: str | None = Field(default=None)
    postgres_db: str = Field(default="curahome")
    postgres_user: str = Field(default="curahome")
    postgres_password: str = Field(default="changeme")

    @computed_field
    @property
    def async_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@db:5432/{self.postgres_db}"
        )

    # ─── Security ───
    secret_key: str = Field(default="")
    encryption_key: str = Field(default="")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # ─── Dev-Login (.env-User, ohne Keycloak) ───
    # Einfacher Username/Passwort-Login für lokale Entwicklung, solange noch
    # kein OIDC angebunden ist. In Produktion: OIDC nutzen, dev_login_enabled
    # auf false setzen (die Prod-.env wird ohnehin neu geschrieben).
    dev_login_enabled: bool = Field(default=False)
    dev_user: str = Field(default="admin")
    dev_password: str = Field(default="admin1234")
    dev_user_role: str = Field(default="admin")

    # ─── OIDC (Keycloak) ───
    # Discovery-URL = Realm-Basis (…/realms/<realm>) ODER volle well-known-URL.
    oidc_discovery_url: str | None = Field(default=None)
    oidc_client_id: str | None = Field(default=None)
    oidc_client_secret: str | None = Field(default=None)
    oidc_redirect_uri: str | None = Field(default=None)
    oidc_scopes: str = "openid email profile"
    oidc_groups_claim: str = "groups"
    # Komma-separierte Liste von IdP-Gruppen, die Admin-Rechte geben.
    oidc_admin_groups: str = ""
    # Fallback: E-Mails, die beim ersten Login Admin werden (Bootstrap).
    admin_emails: str = ""

    # ─── CORS ───
    cors_origins: list[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=False, extra="allow"
    )

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def admin_group_set(self) -> set[str]:
        return {g.strip() for g in self.oidc_admin_groups.split(",") if g.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
