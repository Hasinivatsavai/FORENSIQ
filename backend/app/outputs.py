"""Public response boundaries. Database-only credentials and storage bytes are never serialized by these models."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from .schemas import Classification, Integrity, Priority, Role, Status


class Success(BaseModel):
    ok: bool


class DirectoryEntry(BaseModel):
    id: UUID
    name: str
    role: Role


class Account(DirectoryEntry):
    email: str
    active: bool


class Case(BaseModel):
    id: UUID
    code: str
    title: str
    description: str
    priority: Priority
    status: Status
    owner_id: UUID
    owner_name: str
    created_at: datetime


class Evidence(BaseModel):
    id: UUID
    code: str
    case_id: UUID
    case_code: str
    title: str
    description: str
    classification: Classification
    location: str
    custodian_id: UUID
    custodian_name: str
    status: Literal["registered", "transferred"]
    integrity: Integrity
    filename: str | None
    size_bytes: int | None
    sha256: str | None
    created_at: datetime
    verified_at: datetime | None


class Event(BaseModel):
    id: UUID
    action: str
    actor_name: str
    case_id: UUID | None
    case_code: str | None
    evidence_id: UUID | None
    evidence_code: str | None
    subject_id: UUID | None
    subject_name: str | None
    created_at: datetime


class Note(BaseModel):
    id: UUID
    body: str
    author_name: str
    created_at: datetime


class CaseDetail(Case):
    members: list[DirectoryEntry]
    notes: list[Note]
    evidence: list[Evidence]


class Custody(BaseModel):
    id: UUID
    evidence_id: UUID
    from_name: str | None
    to_name: str
    location: str
    reason: str
    created_at: datetime
    actor_name: str


class Relationship(BaseModel):
    id: UUID
    target_id: UUID
    target_code: str
    target_title: str
    kind: str


class IntegrityCheck(BaseModel):
    id: UUID
    evidence_id: UUID
    digest: str
    matches: bool
    actor_name: str
    created_at: datetime


class EvidenceDetail(Evidence):
    custody: list[Custody]
    relationships: list[Relationship]
    events: list[Event]
    checks: list[IntegrityCheck]


class Verification(BaseModel):
    matches: bool
    sha256: str
    verified_at: datetime


class Statistics(BaseModel):
    cases: int
    open_cases: int
    evidence: int
    verified: int


class CountByLabel(BaseModel):
    label: str
    count: int


class Dashboard(BaseModel):
    counts: Statistics
    by_classification: list[CountByLabel]
    by_status: list[CountByLabel]
    recent_cases: list[Case]
    recent_events: list[Event]


class ReportRelationship(BaseModel):
    id: UUID
    case_id: UUID
    source_id: UUID
    target_id: UUID
    kind: str
    created_at: datetime


class CaseReport(CaseDetail):
    custody: list[Custody]
    integrity_checks: list[IntegrityCheck]
    relationships: list[ReportRelationship]
    activity: list[Event]
    exported_at: datetime
    exported_by: str
