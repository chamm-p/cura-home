"""Pydantic-Schemas für LLM-Backends und System-Settings."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class LlmBackendIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    api_base_url: str = Field(min_length=1, max_length=500)
    # Write-only: nur beim Anlegen/Ändern gesetzt, nie zurückgegeben.
    api_key: str | None = None
    model_id: str = Field(min_length=1, max_length=200)
    supports_vision: bool = False
    supports_tools: bool = False
    is_active: bool = True


class LlmBackendUpdate(BaseModel):
    name: str | None = None
    api_base_url: str | None = None
    api_key: str | None = None
    model_id: str | None = None
    supports_vision: bool | None = None
    supports_tools: bool | None = None
    is_active: bool | None = None


class LlmBackendOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    api_base_url: str
    model_id: str
    capabilities: dict
    is_active: bool
    has_api_key: bool = False


class FetchModelsIn(BaseModel):
    api_base_url: str = Field(min_length=1, max_length=500)
    api_key: str | None = None
    # Optional: bestehendes Backend → gespeicherten Key verwenden.
    backend_id: uuid.UUID | None = None


class FetchModelsOut(BaseModel):
    models: list[str]


class SettingValue(BaseModel):
    value: dict


class SearchConfigIn(BaseModel):
    provider: str = "none"  # none | searxng | tavily
    searxng_url: str | None = None
    # Write-only: nur beim Setzen, nie zurückgegeben.
    tavily_api_key: str | None = None


class SearchConfigOut(BaseModel):
    provider: str
    searxng_url: str | None = None
    has_tavily_key: bool = False
