"""Transport constraints. The schema rejects unexpected mutation fields."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
Location = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
Detail = Annotated[str, StringConstraints(strip_whitespace=True, max_length=6000)]
Body = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=6000)]
Email = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        min_length=3,
        max_length=254,
        pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$",
    ),
]
Role = Literal["admin", "investigator", "viewer"]
Status = Literal["open", "in_review", "closed"]
Priority = Literal["low", "medium", "high", "critical"]
Classification = Literal["document", "image", "video", "audio", "device", "archive", "other"]
Integrity = Literal["recorded", "hashed", "verified", "mismatch"]
Kind = Literal["related_to", "derived_from", "corroborates"]


class Payload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="after")
    @classmethod
    def reject_null_characters(cls, v):
        if isinstance(v, str) and "\x00" in v:
            raise ValueError("Text cannot contain null characters.")
        return v


class Login(Payload):
    email: Email
    password: str = Field(min_length=1, max_length=128, repr=False)


class Registration(Login):
    name: Name
    password: str = Field(min_length=12, max_length=128, repr=False)


class NewUser(Registration):
    role: Role


class SetActive(Payload):
    active: bool = Field(strict=True)


class NewCase(Payload):
    title: Name
    description: Detail = ""
    priority: Priority = "medium"


class SetStatus(Payload):
    status: Status


class NewMember(Payload):
    user_id: UUID


class NewNote(Payload):
    body: Body


class NewEvidence(Payload):
    case_id: UUID
    title: Name
    classification: Classification
    location: Location
    description: Detail = ""


class Transfer(Payload):
    to_user_id: UUID
    location: Location
    reason: Body


class Link(Payload):
    target_id: UUID
    kind: Kind
