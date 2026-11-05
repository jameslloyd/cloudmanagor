"""FastAPI application entrypoint and REST endpoints for CloudManager."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.database import (
    create_connection,
    delete_connection,
    get_connection,
    init_db,
    list_connections,
    update_connection,
)
from app.providers import ProviderRegistry
from app.schemas import (
    InsightStatusUpdate,
    ProviderConnectionCreate,
    ProviderConnectionResponse,
    ProviderConnectionUpdate,
    ProviderMetadata,
    ReportGenerateRequest,
    ReportRecordResponse,
    SyncResult,
    TemplateResponse,
)
from app.services.analytics import (
    ensure_default_demo_data,
    get_dashboard_overview,
    sync_all_connections,
    sync_connection_data,
    update_insight_status,
)
from app.services.pptx_engine import (
    create_default_corporate_template,
    delete_template,
    generate_pptx_report,
    get_report,
    list_reports,
    list_templates,
    save_uploaded_template,
)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_db()
    ensure_default_demo_data()
    create_default_corporate_template()
    yield


app = FastAPI(
    title="CloudManager API",
    description="Modular Multi-Cloud Management, Insights & PowerPoint Report Engine",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "cloudmanager-api"}


@app.get("/api/providers/catalog", response_model=list[ProviderMetadata])
def get_provider_catalog() -> list[ProviderMetadata]:
    """Returns all registered modular provider plugins and their credential schemas."""
    return ProviderRegistry.list_metadata()


@app.get("/api/connections", response_model=list[ProviderConnectionResponse])
def get_connections() -> list[dict]:
    return list_connections()


@app.post("/api/connections", response_model=ProviderConnectionResponse)
def add_connection(payload: ProviderConnectionCreate) -> dict:
    provider = ProviderRegistry.get(payload.provider_id)
    if not provider:
        raise HTTPException(status_code=400, detail=f"Unknown provider_id: {payload.provider_id}")
    conn = create_connection(
        provider_id=payload.provider_id,
        name=payload.name,
        mode=payload.mode,
        credentials=payload.credentials,
    )
    sync_connection_data(conn["id"], days=30)
    updated = get_connection(conn["id"])
    assert updated is not None
    return updated


@app.patch("/api/connections/{connection_id}", response_model=ProviderConnectionResponse)
def patch_connection(connection_id: str, payload: ProviderConnectionUpdate) -> dict:
    updated = update_connection(
        connection_id=connection_id,
        name=payload.name,
        mode=payload.mode,
        credentials=payload.credentials,
        status=payload.status,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Connection not found")
    return updated


@app.delete("/api/connections/{connection_id}")
def remove_connection(connection_id: str) -> dict[str, bool]:
    deleted = delete_connection(connection_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"deleted": True}


@app.post("/api/connections/{connection_id}/sync", response_model=SyncResult)
def sync_single_connection(connection_id: str, days: int = Query(default=30, ge=7, le=90)) -> dict:
    try:
        return sync_connection_data(connection_id, days=days)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/connections/sync-all", response_model=list[SyncResult])
def sync_all(days: int = Query(default=30, ge=7, le=90)) -> list[dict]:
    return sync_all_connections(days=days)


@app.get("/api/dashboard/overview")
def dashboard_overview(
    providers: str | None = Query(default=None, description="Comma-separated provider IDs"),
    domains: str | None = Query(default=None, description="Comma-separated domains"),
    days: int = Query(default=30, ge=7, le=90),
) -> dict:
    prov_list = [p.strip() for p in providers.split(",") if p.strip()] if providers else None
    dom_list = [d.strip() for d in domains.split(",") if d.strip()] if domains else None
    return get_dashboard_overview(providers=prov_list, domains=dom_list, days=days)


@app.patch("/api/insights/{insight_id}")
def patch_insight(insight_id: str, payload: InsightStatusUpdate) -> dict:
    updated = update_insight_status(insight_id, payload.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Insight not found")
    return updated


@app.get("/api/templates", response_model=list[TemplateResponse])
def get_templates() -> list[dict]:
    return list_templates()


@app.get("/api/templates/placeholders")
def get_supported_placeholders() -> list[dict[str, str]]:
    """Returns all supported {{placeholder}} tags for custom PowerPoint templates."""
    return [
        {"tag": "{{report_title}}", "description": "Report main title"},
        {"tag": "{{report_subtitle}}", "description": "Report subtitle / scope"},
        {"tag": "{{report_date}}", "description": "UTC generation date (YYYY-MM-DD)"},
        {"tag": "{{total_spend}}", "description": "Total multi-cloud spend for the period"},
        {"tag": "{{spend_trend}}", "description": "7-day spend trend percentage (e.g. +6.4%)"},
        {"tag": "{{aws_spend}}", "description": "AWS spend for the period"},
        {"tag": "{{cloudflare_spend}}", "description": "Cloudflare spend for the period"},
        {"tag": "{{github_spend}}", "description": "GitHub spend for the period"},
        {"tag": "{{potential_savings}}", "description": "Total estimated monthly savings from open insights"},
        {"tag": "{{open_insights_count}}", "description": "Total open actionable insights"},
        {"tag": "{{critical_alerts}}", "description": "Count of critical & high severity findings"},
        {"tag": "{{cloudflare_requests}}", "description": "Total edge & ALB requests served"},
        {"tag": "{{cache_hit_ratio}}", "description": "Average Cloudflare CDN cache hit ratio (%)"},
        {"tag": "{{aws_alb_latency}}", "description": "Average AWS ALB P95 target latency (ms)"},
        {"tag": "{{github_actions_minutes}}", "description": "Total billable GitHub Actions minutes"},
        {"tag": "{{github_prs_merged}}", "description": "Total GitHub Pull Requests merged"},
        {"tag": "{{top_insight_title}}", "description": "Headline of the highest priority actionable insight"},
        {"tag": "{{top_insight_recommendation}}", "description": "Remediation recommendation for the top insight"},
        {"tag": "{{executive_notes}}", "description": "Custom executive commentary included in report request"},
    ]


@app.post("/api/templates/upload", response_model=TemplateResponse)
async def upload_template(
    name: str = Form(default="Custom Corporate Presentation Template"),
    file: UploadFile = File(...),
) -> dict:
    filename = file.filename or "template.pptx"
    if not filename.lower().endswith(".pptx"):
        raise HTTPException(status_code=400, detail="Only .pptx PowerPoint files are supported.")
    content = await file.read()
    if len(content) < 100:
        raise HTTPException(status_code=400, detail="Uploaded .pptx file appears empty or invalid.")
    try:
        return save_uploaded_template(name=name, filename=filename, content=content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse PowerPoint template: {exc}") from exc


@app.get("/api/templates/{template_id}/download")
def download_template(template_id: str) -> FileResponse:
    from app.database import get_db

    list_templates()
    with get_db() as conn:
        row = conn.execute("SELECT * FROM pptx_templates WHERE id = ?", (template_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Template not found")
        path = Path(row["file_path"])
        if not path.exists():
            raise HTTPException(status_code=404, detail="Template file missing on disk")
        return FileResponse(
            path=str(path),
            filename=row["filename"],
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )


@app.delete("/api/templates/{template_id}")
def remove_template(template_id: str) -> dict[str, bool]:
    ok = delete_template(template_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Cannot delete default or non-existent template.")
    return {"deleted": True}


@app.post("/api/reports/generate", response_model=ReportRecordResponse)
def create_report(payload: ReportGenerateRequest) -> dict:
    return generate_pptx_report(
        title=payload.title,
        subtitle=payload.subtitle,
        template_id=payload.template_id,
        providers=payload.providers,
        domains=payload.domains,
        days=payload.days,
        include_insights=payload.include_insights,
        executive_notes=payload.executive_notes,
    )


@app.get("/api/reports", response_model=list[ReportRecordResponse])
def get_reports_history() -> list[dict]:
    return list_reports()


@app.get("/api/reports/{report_id}/download")
def download_report(report_id: str) -> FileResponse:
    rep = get_report(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found")
    path = Path(rep["file_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Generated PPTX file not found on disk")
    return FileResponse(
        path=str(path),
        filename=rep["filename"],
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
