"""Web-Suche für die Preisrecherche — SearXNG oder Tavily (konfigurierbar).

„search-then-extract": Wir suchen selbst und liefern echte Treffer als Kontext
ans LLM, statt darauf zu hoffen, dass das Modell von sich aus browst. Muster
(rohes httpx, kein SDK) aus curai übernommen.
"""

from __future__ import annotations

import logging

import httpx

from app.core.security import decrypt_value
from app.services.settings_store import get_setting

logger = logging.getLogger(__name__)

SETTING_KEY = "search_config"


async def get_config(db) -> dict:
    return await get_setting(db, SETTING_KEY)


async def web_search(db, query: str, max_results: int = 8) -> dict:
    """Liefert {results: [{title,url,content}], answer, provider}.

    Bei nicht konfiguriertem/fehlerhaftem Provider: leere results (der Aufrufer
    fällt dann auf die reine LLM-Schätzung zurück).
    """
    cfg = await get_config(db)
    provider = cfg.get("provider", "none")
    if provider == "searxng":
        return await _searxng(cfg.get("searxng_url", ""), query, max_results)
    if provider == "tavily":
        key = None
        enc = cfg.get("tavily_api_key_encrypted")
        if enc:
            try:
                key = decrypt_value(enc)
            except Exception:  # noqa: BLE001
                key = None
        return await _tavily(key, query, max_results)
    return {"results": [], "answer": None, "provider": "none"}


def _norm(items, max_results) -> list[dict]:
    out = []
    for x in (items or [])[:max_results]:
        url = x.get("url", "")
        if not url:
            continue
        out.append(
            {
                "title": (x.get("title") or "")[:200],
                "url": url,
                "content": (x.get("content") or "")[:500],
            }
        )
    return out


async def _searxng(url: str, query: str, max_results: int) -> dict:
    url = (url or "").rstrip("/")
    if not url:
        return {"results": [], "answer": None, "provider": "searxng"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{url}/search",
                params={
                    "q": query,
                    "format": "json",
                    "language": "de-DE",
                    "categories": "general",
                },
            )
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError) as e:
        logger.warning("SearXNG-Suche fehlgeschlagen: %s", e)
        return {"results": [], "answer": None, "provider": "searxng"}
    return {"results": _norm(data.get("results"), max_results), "answer": None, "provider": "searxng"}


async def _tavily(key: str | None, query: str, max_results: int) -> dict:
    if not key:
        return {"results": [], "answer": None, "provider": "tavily"}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": key,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": max_results,
                    "include_answer": True,
                },
                headers={"Accept": "application/json"},
            )
        if r.status_code >= 400:
            logger.warning("Tavily-Fehler %s: %s", r.status_code, r.text[:200])
            return {"results": [], "answer": None, "provider": "tavily"}
        data = r.json()
    except (httpx.HTTPError, ValueError) as e:
        logger.warning("Tavily-Suche fehlgeschlagen: %s", e)
        return {"results": [], "answer": None, "provider": "tavily"}
    return {
        "results": _norm(data.get("results"), max_results),
        "answer": data.get("answer"),
        "provider": "tavily",
    }
