"""Pydantic schemas and data models for CloudManager."""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class CredentialFieldSchema(BaseModel):
    key: str
    label: str
    field_type: Literal["text", "password", "select"] = "text"
    required: bool = True
    placeholder: str = ""
    help_text: str = ""


class ProviderMetadata(BaseModel):
    provider_id: str
    display_name: str
    description: str
    category: str
    supported_domains: list[str]
    credential_fields: list[CredentialFieldSchema]


class ProviderConnectionCreate(BaseModel):
    provider_id: str
    name: str
    mode: Literal["mock", "live"] = "mock"
    credentials: dict[str, Any] = Field(default_factory=dict)


class ProviderConnectionUpdate(BaseModel):
    name: str | None = None
    mode: Literal["mock", "live"] | None = None
    credentials: dict[str, Any] | None = None
    status: str | None = None


class ProviderConnectionResponse(BaseModel):
    id: str
    provider_id: str
    name: str
    mode: Literal["mock", "live"]
    status: str
    last_synced_at: str | None = None
    created_at: str
    has_credentials: bool = False


class MetricPointRecord(BaseModel):
    provider_id: str
    connection_id: str
    domain: Literal["cost", "security", "traffic", "devops"]
    metric_name: str
    metric_label: str
    value: float
    unit: str
    recorded_at: str
    dimensions: dict[str, Any] = Field(default_factory=dict)


class InsightRecord(BaseModel):
    id: str | None = None
    provider_id: str
    connection_id: str
    domain: Literal["cost", "security", "traffic", "devops"]
    severity: Literal["critical", "high", "medium", "low"]
    title: str
    summary: str
    recommendation: str
    impact: str
    estimated_savings_usd: float = 0.0
    status: Literal["open", "resolved", "dismissed"] = "open"
    detected_at: str | None = None


class InsightStatusUpdate(BaseModel):
    status: Literal["open", "resolved", "dismissed"]


class SyncResult(BaseModel):
    connection_id: str
    provider_id: str
    mode: str
    metrics_ingested: int
    insights_generated: int
    synced_at: str
    message: str


class TemplateResponse(BaseModel):
    id: str
    name: str
    filename: str
    is_default: bool
    placeholders: list[str]
    slide_count: int
    layout_names: list[str]
    created_at: str


class ReportGenerateRequest(BaseModel):
    title: str = "Executive Cloud Management Report"
    subtitle: str = "Multi-Cloud Cost, Security, Performance & Engineering Insights"
    template_id: str | None = None
    providers: list[str] = Field(default_factory=lambda: ["aws", "cloudflare", "github"])
    domains: list[str] = Field(default_factory=lambda: ["cost", "security", "traffic", "devops"])
    days: int = 30
    include_insights: bool = True
    executive_notes: str = ""


class ReportRecordResponse(BaseModel):
    id: str
    title: str
    subtitle: str
    template_id: str | None
    template_name: str
    providers: list[str]
    domains: list[str]
    filename: str
    slide_count: int
    placeholders_replaced: dict[str, str]
    created_at: str
