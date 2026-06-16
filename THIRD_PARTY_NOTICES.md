# Third-Party Notices

cura-home ist unter der MIT-Lizenz veröffentlicht (siehe `LICENSE`). Es nutzt
folgende Open-Source-Abhängigkeiten — alle unter permissiven, MIT-kompatiblen
Lizenzen (MIT, BSD, Apache-2.0, ISC, Unlicense, MIT-CMU/HPND). Keine
Copyleft-Lizenzen (GPL/LGPL/AGPL/MPL).

## Backend (Python)

| Paket | Lizenz |
|---|---|
| FastAPI, SQLAlchemy, Alembic, pydantic, pydantic-settings, python-jose, json-repair, greenlet | MIT |
| Uvicorn, Authlib, httpx, python-dotenv, WeasyPrint, qrcode | BSD |
| python-multipart, asyncpg, cryptography | Apache-2.0 (cryptography zusätzlich BSD) |
| email-validator | Unlicense |
| Pillow | MIT-CMU (HPND) |

## Frontend (npm)

| Paket | Lizenz |
|---|---|
| React, React DOM, Radix UI, axios, clsx, framer-motion, zustand, react-router-dom, tailwind-merge, Tailwind CSS, Vite, PostCSS, autoprefixer, @types/* | MIT |
| html5-qrcode, TypeScript | Apache-2.0 |
| lucide-react | ISC |

Die jeweiligen Lizenztexte liegen in den `node_modules`- bzw. Python-Paket-
Metadaten der Abhängigkeiten. Diese Übersicht erhebt keinen Anspruch auf
juristische Vollständigkeit, fasst aber den Stand der direkten Abhängigkeiten
zusammen.
