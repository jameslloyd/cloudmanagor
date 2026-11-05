"""Analytics, cross-provider trend aggregation, and insight management service."""

from __future__ import annotations

import json
from typing import Any

from app.database import (
    create_connection,
    get_connection,
    get_db,
    list_connections,
    replace_connection_sync_data,
)
from app.providers import ProviderRegistry


def ensure_default_demo_data() -> None:
    """Seeds default AWS, Cloudflare, and GitHub connections and 30-day data if DB is empty."""
    existing = list_connections()
    if existing:
        return

    defaults = [
        ("aws", "AWS Production Organization (us-east-1)", "mock"),
        ("cloudflare", "Cloudflare Global Edge (acme-cloud.io)", "mock"),
        ("github", "GitHub Enterprise (acme-corp)", "mock"),
    ]
    for provider_id, name, mode in defaults:
        conn = create_connection(provider_id=provider_id, name=name, mode=mode)
        sync_connection_data(conn["id"], days=30)


def sync_connection_data(connection_id: str, days: int = 30) -> dict[str, Any]:
    conn_record = get_connection(connection_id)
    if not conn_record:
        raise ValueError(f"Connection '{connection_id}' not found.")

    provider = ProviderRegistry.get(conn_record["provider_id"])
    if not provider:
        raise ValueError(f"Provider '{conn_record['provider_id']}' is not registered.")

    metrics, insights, message = provider.collect_data(
        connection_id=connection_id,
        mode=conn_record["mode"],
        credentials=conn_record.get("credentials", {}),
        days=days,
    )
    m_count, i_count = replace_connection_sync_data(connection_id, metrics, insights)
    updated = get_connection(connection_id)
    return {
        "connection_id": connection_id,
        "provider_id": conn_record["provider_id"],
        "mode": conn_record["mode"],
        "metrics_ingested": m_count,
        "insights_generated": i_count,
        "synced_at": updated["last_synced_at"] if updated else "",
        "message": message,
    }


def sync_all_connections(days: int = 30) -> list[dict[str, Any]]:
    results = []
    for conn in list_connections():
        results.append(sync_connection_data(conn["id"], days=days))
    return results


def get_dashboard_overview(
    providers: list[str] | None = None,
    domains: list[str] | None = None,
    days: int = 30,
) -> dict[str, Any]:
    selected_providers = providers or ["aws", "cloudflare", "github"]
    selected_domains = domains or ["cost", "security", "traffic", "devops"]

    with get_db() as conn:
        placeholders_prov = ",".join("?" for _ in selected_providers)
        placeholders_dom = ",".join("?" for _ in selected_domains)

        metric_rows = conn.execute(
            f"""
            SELECT provider_id, domain, metric_name, metric_label, value, unit, recorded_at, dimensions_json
            FROM metric_points
            WHERE provider_id IN ({placeholders_prov})
              AND domain IN ({placeholders_dom})
            ORDER BY recorded_at ASC
            """,
            [*selected_providers, *selected_domains],
        ).fetchall()

        insight_rows = conn.execute(
            f"""
            SELECT *
            FROM insights
            WHERE provider_id IN ({placeholders_prov})
              AND domain IN ({placeholders_dom})
            ORDER BY
              CASE severity
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                ELSE 4
              END ASC,
              estimated_savings_usd DESC
            """,
            [*selected_providers, *selected_domains],
        ).fetchall()

    # Organize daily time series across dates
    cost_by_date: dict[str, dict[str, float]] = {}
    traffic_by_date: dict[str, dict[str, float]] = {}
    devops_by_date: dict[str, dict[str, float]] = {}
    security_by_date: dict[str, dict[str, float]] = {}

    provider_spend_totals: dict[str, float] = {p: 0.0 for p in selected_providers}
    total_edge_requests = 0.0
    cache_hit_values: list[float] = []
    alb_latency_values: list[float] = []
    actions_minutes_total = 0.0
    prs_merged_total = 0.0

    for row in metric_rows:
        day = row["recorded_at"]
        m_name = row["metric_name"]
        val = float(row["value"])
        prov = row["provider_id"]

        if m_name in ("aws_daily_spend", "cf_daily_spend", "gh_daily_spend"):
            bucket = cost_by_date.setdefault(
                day, {"date": day, "aws": 0.0, "cloudflare": 0.0, "github": 0.0, "total": 0.0}  # type: ignore[arg-type]
            )
            bucket[prov] = round(bucket.get(prov, 0.0) + val, 2)
            bucket["total"] = round(bucket["total"] + val, 2)
            provider_spend_totals[prov] = round(provider_spend_totals.get(prov, 0.0) + val, 2)

        elif m_name in ("aws_alb_requests", "cf_edge_requests"):
            t_bucket = traffic_by_date.setdefault(
                day,
                {"date": day, "aws_requests": 0.0, "cf_requests": 0.0, "cache_hit_ratio": 0.0, "alb_p95_ms": 0.0},  # type: ignore[arg-type]
            )
            if m_name == "aws_alb_requests":
                t_bucket["aws_requests"] = val
                total_edge_requests += val
            else:
                t_bucket["cf_requests"] = val
                total_edge_requests += val

        elif m_name == "cf_cache_hit_ratio":
            t_bucket = traffic_by_date.setdefault(
                day,
                {"date": day, "aws_requests": 0.0, "cf_requests": 0.0, "cache_hit_ratio": 0.0, "alb_p95_ms": 0.0},  # type: ignore[arg-type]
            )
            t_bucket["cache_hit_ratio"] = val
            cache_hit_values.append(val)

        elif m_name == "aws_alb_p95_latency":
            t_bucket = traffic_by_date.setdefault(
                day,
                {"date": day, "aws_requests": 0.0, "cf_requests": 0.0, "cache_hit_ratio": 0.0, "alb_p95_ms": 0.0},  # type: ignore[arg-type]
            )
            t_bucket["alb_p95_ms"] = val
            alb_latency_values.append(val)

        elif m_name in ("gh_actions_minutes", "gh_prs_merged", "gh_pr_cycle_time_hours"):
            d_bucket = devops_by_date.setdefault(
                day,
                {"date": day, "actions_minutes": 0.0, "prs_merged": 0.0, "cycle_time_hours": 0.0},  # type: ignore[arg-type]
            )
            if m_name == "gh_actions_minutes":
                d_bucket["actions_minutes"] = val
                actions_minutes_total += val
            elif m_name == "gh_prs_merged":
                d_bucket["prs_merged"] = val
                prs_merged_total += val
            elif m_name == "gh_pr_cycle_time_hours":
                d_bucket["cycle_time_hours"] = val

        elif m_name in ("aws_security_findings", "cf_waf_blocked_threats", "gh_dependabot_alerts"):
            s_bucket = security_by_date.setdefault(
                day,
                {"date": day, "aws_findings": 0.0, "cf_waf_threats": 0.0, "gh_alerts": 0.0},  # type: ignore[arg-type]
            )
            if m_name == "aws_security_findings":
                s_bucket["aws_findings"] = val
            elif m_name == "cf_waf_blocked_threats":
                s_bucket["cf_waf_threats"] = val
            elif m_name == "gh_dependabot_alerts":
                s_bucket["gh_alerts"] = val

    cost_series = sorted(cost_by_date.values(), key=lambda x: str(x["date"]))[-days:]
    traffic_series = sorted(traffic_by_date.values(), key=lambda x: str(x["date"]))[-days:]
    devops_series = sorted(devops_by_date.values(), key=lambda x: str(x["date"]))[-days:]
    security_series = sorted(security_by_date.values(), key=lambda x: str(x["date"]))[-days:]

    total_spend = round(sum(provider_spend_totals.values()), 2)

    # Calculate 7d vs previous 7d spend trend %
    spend_trend_pct = 0.0
    if len(cost_series) >= 14:
        recent_7d = sum(float(item["total"]) for item in cost_series[-7:])
        prev_7d = sum(float(item["total"]) for item in cost_series[-14:-7])
        if prev_7d > 0:
            spend_trend_pct = round(((recent_7d - prev_7d) / prev_7d) * 100.0, 1)

    insights_list = [dict(r) for r in insight_rows]
    open_insights = [i for i in insights_list if i["status"] == "open"]
    critical_high_count = sum(
        1 for i in open_insights if i["severity"] in ("critical", "high")
    )
    potential_savings = round(
        sum(float(i["estimated_savings_usd"]) for i in open_insights), 2
    )

    avg_cache_hit = (
        round(sum(cache_hit_values) / len(cache_hit_values), 1)
        if cache_hit_values
        else 0.0
    )
    avg_alb_latency = (
        round(sum(alb_latency_values) / len(alb_latency_values), 1)
        if alb_latency_values
        else 0.0
    )

    return {
        "kpis": {
            "total_spend_usd": total_spend,
            "spend_trend_pct": spend_trend_pct,
            "potential_monthly_savings_usd": potential_savings,
            "open_insights_count": len(open_insights),
            "critical_high_alerts": critical_high_count,
            "total_requests": int(total_edge_requests),
            "avg_cache_hit_ratio": avg_cache_hit,
            "avg_alb_p95_latency_ms": avg_alb_latency,
            "github_actions_minutes": int(actions_minutes_total),
            "github_prs_merged": int(prs_merged_total),
            "provider_spend_breakdown": provider_spend_totals,
        },
        "series": {
            "cost": cost_series,
            "traffic": traffic_series,
            "devops": devops_series,
            "security": security_series,
        },
        "insights": insights_list,
        "connections": list_connections(),
    }


def update_insight_status(insight_id: str, status: str) -> dict[str, Any] | None:
    with get_db() as conn:
        conn.execute(
            "UPDATE insights SET status = ? WHERE id = ?",
            (status, insight_id),
        )
        row = conn.execute(
            "SELECT * FROM insights WHERE id = ?",
            (insight_id,),
        ).fetchone()
        return dict(row) if row else None
