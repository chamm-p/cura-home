"""Pydantic-Schemas für Häuser und Mitgliedschaften."""

import uuid

from pydantic import BaseModel, Field


class HouseIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    currency: str = Field(default="EUR", min_length=3, max_length=3)


class HouseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    currency: str | None = Field(default=None, min_length=3, max_length=3)


class HouseOut(BaseModel):
    id: uuid.UUID
    name: str
    currency: str
    owner_id: uuid.UUID
    role: str
    is_owner: bool
    member_count: int


class HouseMemberOut(BaseModel):
    user_id: uuid.UUID
    email: str
    name: str
    role: str
    is_owner: bool


class AddMemberIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
