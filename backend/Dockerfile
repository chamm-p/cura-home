FROM python:3.12-slim

# WeasyPrint braucht Pango/Cairo/GDK-Pixbuf; libzbar0 nicht nötig (QR nur
# Generierung serverseitig, Scan passiert im Browser).
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libcairo2 \
        libgdk-pixbuf-2.0-0 \
        libffi-dev \
        shared-mime-info \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m appuser && mkdir -p /app/uploads && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Migrationen anwenden, dann Server starten.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
