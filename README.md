# cura-home

Web-App zur Erfassung des Haushaltsinventars: Hausbereiche anlegen, Objekte per
Smartphone-Kamera fotografieren, via Vision-LLM erkennen & benennen, Neupreis
(manuell oder per LLM/Websuche) erfassen, Inventarlisten drucken (PDF/Print) und
QR-Etiketten für Boxen/Schränke generieren & scannen.

Eigenständiger Stack, der bewährte Muster aus `../curai` wiederverwendet
(OIDC/Auth, OpenAI-kompatible LLM-Backends mit Vision, Settings, UI, Docker).

## Stack

- **Backend:** FastAPI · SQLAlchemy 2 async · PostgreSQL · Alembic · Authlib (OIDC) ·
  WeasyPrint (PDF) · qrcode
- **Frontend:** React 19 · Vite · TypeScript · Tailwind v4 · Radix UI · Zustand
- **Deploy:** Docker Compose (`db`, `backend`, `frontend`)

## Schnellstart

```bash
cd deploy
cp .env.example .env        # Secrets + OIDC ausfüllen (siehe unten)
docker compose up -d --build
```

- Frontend: http://localhost:9611
- Backend-API: http://localhost:9615/api/health
- Migrationen (`alembic upgrade head`) laufen beim Backend-Start automatisch.

### Secrets erzeugen

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"                       # SECRET_KEY
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # ENCRYPTION_KEY
```

### Keycloak-Client

Im Realm einen OIDC-Client anlegen (z.B. `cura-home`):

- **Access Type:** confidential (Client-Secret in `.env` → `OIDC_CLIENT_SECRET`)
- **Valid Redirect URIs:** `http://localhost:9611/login` (muss `OIDC_REDIRECT_URI` entsprechen)
- **Discovery-URL:** `https://<keycloak>/realms/<realm>` → `OIDC_DISCOVERY_URL`
- Optional Gruppen-Claim `groups` ins Token mappen; Admin-Gruppen in
  `OIDC_ADMIN_GROUPS` eintragen. Alternativ Bootstrap über `ADMIN_EMAILS`.

## Status / Roadmap

- **Phase 1 (fertig):** Docker-Stack, OIDC- + Dev-Login mit animiertem
  Loginscreen, Datenmodell + Migration, `/api/users/me`.
- **Phase 2 (fertig):** Bereiche-CRUD, Foto-Capture mit Vision-Erkennung,
  gefilterte Inventarliste (Bereich/unkatalogisiert/ohne Preis) mit Summen je
  Bereich + Total, LLM-Backend-Verwaltung (Admin-Settings).
- **Häuser/Sharing (fertig):** Bereiche & Objekte gehören zu einem Haus/Wohnung
  (`X-House-Id`-Scoping wie curai-Workspaces). Owner legt Häuser an und teilt sie
  per E-Mail mit bestehenden Usern (gleiche Inventar-Rechte; nur Owner verwaltet
  Mitglieder/löscht). Beim ersten Login wird „Mein Zuhause" auto-angelegt.
- **Phase 3 (offen):** Preis-Indikation (LLM/Websuche), PDF/Print-Export,
  QR-Etiketten + Scan, Custom Fields.

## Entwicklung (ohne Docker)

```bash
# Backend
cd backend && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
export $(grep -v '^#' ../deploy/.env | xargs)   # oder Vars manuell setzen
alembic upgrade head
uvicorn app.main:app --reload --port 9615

# Frontend (Proxy zeigt auf :9615)
cd frontend && npm install && npm run dev
```

## Lizenz

MIT — siehe [LICENSE](LICENSE). Verwendete Open-Source-Abhängigkeiten und deren
Lizenzen sind in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) aufgeführt
(alle permissiv, MIT-kompatibel).
