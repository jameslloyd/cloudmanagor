"""PowerPoint (.pptx) Template & Report Generation Engine using python-pptx."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

from app.database import DATA_DIR, ensure_directories, get_db, now_iso
from app.services.analytics import get_dashboard_overview

PLACEHOLDER_REGEX = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")

# Executive color palette
NAVY_BG = RGBColor(15, 23, 42)
SLATE_CARD = RGBColor(30, 41, 59)
BRAND_BLUE = RGBColor(56, 189, 248)
AWS_AMBER = RGBColor(245, 158, 11)
CF_ORANGE = RGBColor(249, 115, 22)
GH_PURPLE = RGBColor(168, 85, 247)
EMERALD = RGBColor(16, 185, 129)
CRIT_RED = RGBColor(239, 68, 68)
TEXT_WHITE = RGBColor(248, 250, 252)
TEXT_MUTED = RGBColor(148, 163, 184)
TEXT_DARK = RGBColor(15, 23, 42)


def inspect_pptx_template(file_path: Path) -> tuple[list[str], int, list[str]]:
    """Inspects a .pptx file and extracts {{placeholder}} tags, slide count, and master layout names."""
    prs = Presentation(str(file_path))
    found_tags: set[str] = set()

    for slide in prs.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                text = shape.text_frame.text or ""
                for match in PLACEHOLDER_REGEX.findall(text):
                    found_tags.add(match)
            if shape.has_table:
                for row in shape.table.rows:
                    for cell in row.cells:
                        for match in PLACEHOLDER_REGEX.findall(cell.text or ""):
                            found_tags.add(match)

    layout_names = [layout.name for layout in prs.slide_layouts]
    return sorted(found_tags), len(prs.slides), layout_names


def _add_styled_card(
    slide: Any,
    left: float,
    top: float,
    width: float,
    height: float,
    fill_rgb: RGBColor,
    border_rgb: RGBColor | None = None,
) -> Any:
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(left),
        Inches(top),
        Inches(width),
        Inches(height),
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_rgb
    if border_rgb:
        shape.line.color.rgb = border_rgb
        shape.line.width = Pt(1.25)
    else:
        shape.line.fill.background()
    return shape


def create_default_corporate_template() -> dict[str, Any]:
    """Creates a built-in Executive Cloud Strategy PowerPoint template with {{placeholders}}."""
    ensure_directories()
    with get_db() as conn:
        existing = conn.execute(
            "SELECT * FROM pptx_templates WHERE is_default = 1 LIMIT 1"
        ).fetchone()
        if existing and Path(existing["file_path"]).exists():
            return _row_to_template_dict(existing)

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6] if len(prs.slide_layouts) > 6 else prs.slide_layouts[0]

    # --- Slide 1: Executive Cover Slide with Placeholders ---
    slide1 = prs.slides.add_slide(blank_layout)
    bg1 = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = NAVY_BG
    bg1.line.fill.background()

    # Accent top bar
    accent = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(0.14))
    accent.fill.solid()
    accent.fill.fore_color.rgb = BRAND_BLUE
    accent.line.fill.background()

    title_box = slide1.shapes.add_textbox(Inches(0.9), Inches(1.1), Inches(11.5), Inches(2.2))
    tf = title_box.text_frame
    tf.word_wrap = True
    p0 = tf.paragraphs[0]
    p0.text = "CLOUD MANAGEMENT & INSIGHTS BRIEFING"
    p0.font.size = Pt(13)
    p0.font.bold = True
    p0.font.color.rgb = BRAND_BLUE

    p1 = tf.add_paragraph()
    p1.text = "{{report_title}}"
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.color.rgb = TEXT_WHITE

    p2 = tf.add_paragraph()
    p2.text = "{{report_subtitle}}"
    p2.font.size = Pt(18)
    p2.font.color.rgb = TEXT_MUTED

    # 4 Executive KPI Cards on Cover Slide with Placeholders
    kpi_specs = [
        ("TOTAL 30D CLOUD SPEND", "{{total_spend}}", "7d Trend: {{spend_trend}}", BRAND_BLUE),
        ("IDENTIFIED SAVINGS", "{{potential_savings}}", "Actionable Monthly Run-Rate", EMERALD),
        ("OPEN INSIGHTS & ALERTS", "{{open_insights_count}}", "{{critical_alerts}} Critical / High Priority", CRIT_RED),
        ("EDGE & CI/CD THROUGHPUT", "{{cloudflare_requests}}", "Cache Hit: {{cache_hit_ratio}} | PRs: {{github_prs_merged}}", AWS_AMBER),
    ]
    for idx, (label, main_tag, sub_tag, color) in enumerate(kpi_specs):
        left = 0.9 + idx * 2.95
        card = _add_styled_card(slide1, left, 3.8, 2.75, 2.15, SLATE_CARD, color)
        ctf = card.text_frame
        ctf.word_wrap = True
        cp0 = ctf.paragraphs[0]
        cp0.text = label
        cp0.font.size = Pt(10)
        cp0.font.bold = True
        cp0.font.color.rgb = TEXT_MUTED

        cp1 = ctf.add_paragraph()
        cp1.text = main_tag
        cp1.font.size = Pt(24)
        cp1.font.bold = True
        cp1.font.color.rgb = TEXT_WHITE

        cp2 = ctf.add_paragraph()
        cp2.text = sub_tag
        cp2.font.size = Pt(11)
        cp2.font.color.rgb = color

    footer_box = slide1.shapes.add_textbox(Inches(0.9), Inches(6.45), Inches(11.5), Inches(0.6))
    ftf = footer_box.text_frame
    fp = ftf.paragraphs[0]
    fp.text = "Generated on {{report_date}} | Providers: AWS ({{aws_spend}}) • Cloudflare ({{cloudflare_spend}}) • GitHub ({{github_spend}})"
    fp.font.size = Pt(12)
    fp.font.color.rgb = TEXT_MUTED

    # --- Slide 2: Template Executive Summary & Top Priority Insight ---
    slide2 = prs.slides.add_slide(blank_layout)
    bg2 = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg2.fill.solid()
    bg2.fill.fore_color.rgb = RGBColor(248, 250, 252)
    bg2.line.fill.background()

    hdr2 = slide2.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(1.1))
    htf2 = hdr2.text_frame
    hp0 = htf2.paragraphs[0]
    hp0.text = "Executive Summary & Key Actionable Takeaway"
    hp0.font.size = Pt(26)
    hp0.font.bold = True
    hp0.font.color.rgb = TEXT_DARK

    hp1 = htf2.add_paragraph()
    hp1.text = "Automated synthesis for {{report_title}} ({{report_date}})"
    hp1.font.size = Pt(13)
    hp1.font.color.rgb = RGBColor(71, 85, 105)

    summary_card = _add_styled_card(
        slide2, 0.8, 1.75, 11.7, 2.3, RGBColor(255, 255, 255), RGBColor(203, 213, 225)
    )
    stf = summary_card.text_frame
    stf.word_wrap = True
    sp0 = stf.paragraphs[0]
    sp0.text = "CROSS-PLATFORM TELEMETRY HIGHLIGHTS"
    sp0.font.size = Pt(11)
    sp0.font.bold = True
    sp0.font.color.rgb = RGBColor(37, 99, 235)

    sp1 = stf.add_paragraph()
    sp1.text = (
        "• Total Multi-Cloud Spend: {{total_spend}} (AWS: {{aws_spend}}, Cloudflare: {{cloudflare_spend}}, GitHub: {{github_spend}})\n"
        "• Identified Optimization Savings: {{potential_savings}}/month across {{open_insights_count}} active findings\n"
        "• Edge & Application Reliability: {{cloudflare_requests}} requests served at {{cache_hit_ratio}} cache hit ratio (ALB P95: {{aws_alb_latency}})\n"
        "• Engineering Velocity: {{github_prs_merged}} pull requests merged | {{github_actions_minutes}} CI/CD runner minutes"
    )
    sp1.font.size = Pt(14)
    sp1.font.color.rgb = TEXT_DARK

    spotlight_card = _add_styled_card(
        slide2, 0.8, 4.35, 11.7, 2.4, NAVY_BG, CRIT_RED
    )
    ptf = spotlight_card.text_frame
    ptf.word_wrap = True
    pp0 = ptf.paragraphs[0]
    pp0.text = "TOP PRIORITY ACTIONABLE INSIGHT"
    pp0.font.size = Pt(11)
    pp0.font.bold = True
    pp0.font.color.rgb = BRAND_BLUE

    pp1 = ptf.add_paragraph()
    pp1.text = "{{top_insight_title}}"
    pp1.font.size = Pt(18)
    pp1.font.bold = True
    pp1.font.color.rgb = TEXT_WHITE

    pp2 = ptf.add_paragraph()
    pp2.text = "Recommended Action: {{top_insight_recommendation}}"
    pp2.font.size = Pt(13)
    pp2.font.color.rgb = TEXT_MUTED

    pp3 = ptf.add_paragraph()
    pp3.text = "Executive Notes: {{executive_notes}}"
    pp3.font.size = Pt(12)
    pp3.font.color.rgb = EMERALD

    template_path = DATA_DIR / "templates" / "default_executive_template.pptx"
    prs.save(str(template_path))

    placeholders, slide_count, layouts = inspect_pptx_template(template_path)
    tid = "tpl-default-executive"
    created = now_iso()

    with get_db() as conn:
        conn.execute("DELETE FROM pptx_templates WHERE id = ?", (tid,))
        conn.execute(
            """
            INSERT INTO pptx_templates
            (id, name, filename, file_path, is_default, placeholders_json, slide_count, layout_names_json, created_at)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
            """,
            (
                tid,
                "Executive Cloud Strategy Template (Default)",
                template_path.name,
                str(template_path),
                json.dumps(placeholders),
                slide_count,
                json.dumps(layouts),
                created,
            ),
        )
        row = conn.execute("SELECT * FROM pptx_templates WHERE id = ?", (tid,)).fetchone()
        return _row_to_template_dict(row)


def _row_to_template_dict(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "filename": row["filename"],
        "is_default": bool(row["is_default"]),
        "placeholders": json.loads(row["placeholders_json"] or "[]"),
        "slide_count": int(row["slide_count"]),
        "layout_names": json.loads(row["layout_names_json"] or "[]"),
        "created_at": row["created_at"],
    }


def list_templates() -> list[dict[str, Any]]:
    create_default_corporate_template()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM pptx_templates ORDER BY is_default DESC, created_at DESC"
        ).fetchall()
        return [_row_to_template_dict(r) for r in rows]


def save_uploaded_template(name: str, filename: str, content: bytes) -> dict[str, Any]:
    ensure_directories()
    tid = f"tpl-{uuid.uuid4().hex[:10]}"
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", filename)
    if not safe_name.lower().endswith(".pptx"):
        safe_name += ".pptx"
    file_path = DATA_DIR / "templates" / f"{tid}_{safe_name}"
    file_path.write_bytes(content)

    placeholders, slide_count, layouts = inspect_pptx_template(file_path)
    created = now_iso()

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO pptx_templates
            (id, name, filename, file_path, is_default, placeholders_json, slide_count, layout_names_json, created_at)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)
            """,
            (
                tid,
                name.strip() or filename,
                safe_name,
                str(file_path),
                json.dumps(placeholders),
                slide_count,
                json.dumps(layouts),
                created,
            ),
        )
        row = conn.execute("SELECT * FROM pptx_templates WHERE id = ?", (tid,)).fetchone()
        return _row_to_template_dict(row)


def delete_template(template_id: str) -> bool:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM pptx_templates WHERE id = ?", (template_id,)
        ).fetchone()
        if not row or row["is_default"]:
            return False
        path = Path(row["file_path"])
        if path.exists():
            path.unlink()
        conn.execute("DELETE FROM pptx_templates WHERE id = ?", (template_id,))
        return True


def _replace_placeholders_in_presentation(
    prs: Presentation, replacements: dict[str, str]
) -> dict[str, str]:
    """Replaces {{tag}} tokens across all text frames and table cells while preserving formatting."""
    used_replacements: dict[str, str] = {}

    def replace_in_text(raw_text: str) -> str:
        updated = raw_text
        for key, val in replacements.items():
            pattern = re.compile(r"\{\{\s*" + re.escape(key) + r"\s*\}\}")
            if pattern.search(updated):
                updated = pattern.sub(val, updated)
                used_replacements[key] = val
        return updated

    for slide in prs.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    full_p_text = "".join(run.text for run in paragraph.runs) or paragraph.text
                    if "{{" in full_p_text:
                        new_p_text = replace_in_text(full_p_text)
                        if paragraph.runs:
                            paragraph.runs[0].text = new_p_text
                            for extra_run in paragraph.runs[1:]:
                                extra_run.text = ""
                        else:
                            paragraph.text = new_p_text
            if shape.has_table:
                for row in shape.table.rows:
                    for cell in row.cells:
                        if "{{" in (cell.text or ""):
                            cell.text = replace_in_text(cell.text)

    return used_replacements


def _pick_blank_or_content_layout(prs: Presentation) -> Any:
    for layout in prs.slide_layouts:
        if "blank" in layout.name.lower():
            return layout
    return prs.slide_layouts[-1] if len(prs.slide_layouts) > 0 else prs.slide_layouts[0]


def generate_pptx_report(
    title: str,
    subtitle: str,
    template_id: str | None,
    providers: list[str],
    domains: list[str],
    days: int = 30,
    include_insights: bool = True,
    executive_notes: str = "",
) -> dict[str, Any]:
    """Generates a customized PowerPoint presentation using the selected template + live/mock DB telemetry."""
    ensure_directories()
    create_default_corporate_template()

    with get_db() as conn:
        if template_id:
            tpl_row = conn.execute(
                "SELECT * FROM pptx_templates WHERE id = ?", (template_id,)
            ).fetchone()
        else:
            tpl_row = None
        if not tpl_row:
            tpl_row = conn.execute(
                "SELECT * FROM pptx_templates WHERE is_default = 1 LIMIT 1"
            ).fetchone()

    template_path = Path(tpl_row["file_path"])
    template_name = tpl_row["name"]

    overview = get_dashboard_overview(providers=providers, domains=domains, days=days)
    kpis = overview["kpis"]
    insights = overview["insights"]
    cost_series = overview["series"]["cost"]
    traffic_series = overview["series"]["traffic"]
    devops_series = overview["series"]["devops"]

    top_insight = insights[0] if insights else {
        "title": "All Cloud Systems Operating Within Optimal Thresholds",
        "recommendation": "Continue monitoring weekly spend and security posture baselines.",
    }

    spend_breakdown = kpis.get("provider_spend_breakdown", {})
    aws_spend = spend_breakdown.get("aws", 0.0)
    cf_spend = spend_breakdown.get("cloudflare", 0.0)
    gh_spend = spend_breakdown.get("github", 0.0)
    trend_val = kpis["spend_trend_pct"]
    trend_str = f"{'+' if trend_val >= 0 else ''}{trend_val}%"

    replacements = {
        "report_title": title,
        "report_subtitle": subtitle,
        "report_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "total_spend": f"${kpis['total_spend_usd']:,.2f}",
        "spend_trend": trend_str,
        "aws_spend": f"${aws_spend:,.2f}",
        "cloudflare_spend": f"${cf_spend:,.2f}",
        "github_spend": f"${gh_spend:,.2f}",
        "potential_savings": f"${kpis['potential_monthly_savings_usd']:,.2f}/mo",
        "open_insights_count": str(kpis["open_insights_count"]),
        "critical_alerts": str(kpis["critical_high_alerts"]),
        "cloudflare_requests": f"{kpis['total_requests']:,}",
        "cache_hit_ratio": f"{kpis['avg_cache_hit_ratio']}%",
        "aws_alb_latency": f"{kpis['avg_alb_p95_latency_ms']} ms",
        "github_actions_minutes": f"{kpis['github_actions_minutes']:,}",
        "github_prs_merged": str(kpis["github_prs_merged"]),
        "top_insight_title": top_insight["title"],
        "top_insight_recommendation": top_insight["recommendation"],
        "executive_notes": executive_notes.strip() or "Prioritize critical IAM & Dependabot remediations alongside EC2 rightsizing.",
    }

    prs = Presentation(str(template_path))
    used_placeholders = _replace_placeholders_in_presentation(prs, replacements)

    layout = _pick_blank_or_content_layout(prs)
    slide_w_in = prs.slide_width.inches
    slide_h_in = prs.slide_height.inches

    # --- Appended Slide A: Multi-Cloud Cost Trend Native Chart ---
    if "cost" in domains and cost_series:
        cost_slide = prs.slides.add_slide(layout)
        hdr = cost_slide.shapes.add_textbox(Inches(0.7), Inches(0.4), Inches(slide_w_in - 1.4), Inches(0.9))
        htf = hdr.text_frame
        hp = htf.paragraphs[0]
        hp.text = "Multi-Cloud Spend Trend & Provider Breakdown"
        hp.font.size = Pt(24)
        hp.font.bold = True
        hp.font.color.rgb = TEXT_DARK

        subp = htf.add_paragraph()
        subp.text = f"Total {days}-Day Spend: ${kpis['total_spend_usd']:,.2f} ({trend_str} 7d trend) | Identified Savings: ${kpis['potential_monthly_savings_usd']:,.2f}/mo"
        subp.font.size = Pt(12)
        subp.font.color.rgb = RGBColor(71, 85, 105)

        sampled_cost = cost_series[-14:] if len(cost_series) > 14 else cost_series
        chart_data = CategoryChartData()
        chart_data.categories = [str(item["date"])[5:] for item in sampled_cost]
        if "aws" in providers:
            chart_data.add_series("AWS Spend ($)", [float(item.get("aws", 0.0)) for item in sampled_cost])
        if "cloudflare" in providers:
            chart_data.add_series("Cloudflare Spend ($)", [float(item.get("cloudflare", 0.0)) for item in sampled_cost])
        if "github" in providers:
            chart_data.add_series("GitHub Spend ($)", [float(item.get("github", 0.0)) for item in sampled_cost])

        chart_shape = cost_slide.shapes.add_chart(
            XL_CHART_TYPE.COLUMN_STACKED,
            Inches(0.7),
            Inches(1.45),
            Inches(slide_w_in - 1.4),
            Inches(min(5.3, slide_h_in - 1.9)),
            chart_data,
        )
        chart = chart_shape.chart
        chart.has_legend = True
        chart.legend.position = XL_LEGEND_POSITION.TOP
        chart.legend.include_in_layout = False

    # --- Appended Slide B: Edge Traffic, Latency & Engineering Velocity ---
    if ("traffic" in domains or "devops" in domains) and (traffic_series or devops_series):
        perf_slide = prs.slides.add_slide(layout)
        hdr = perf_slide.shapes.add_textbox(Inches(0.7), Inches(0.4), Inches(slide_w_in - 1.4), Inches(0.9))
        htf = hdr.text_frame
        hp = htf.paragraphs[0]
        hp.text = "Edge Performance, Reliability & Developer Velocity"
        hp.font.size = Pt(24)
        hp.font.bold = True
        hp.font.color.rgb = TEXT_DARK

        subp = htf.add_paragraph()
        subp.text = (
            f"Requests: {kpis['total_requests']:,} | Avg Cache Hit: {kpis['avg_cache_hit_ratio']}% | "
            f"ALB P95 Latency: {kpis['avg_alb_p95_latency_ms']} ms | GitHub PRs Merged: {kpis['github_prs_merged']}"
        )
        subp.font.size = Pt(12)
        subp.font.color.rgb = RGBColor(71, 85, 105)

        if traffic_series:
            sampled_traffic = traffic_series[-10:]
            t_data = CategoryChartData()
            t_data.categories = [str(item["date"])[5:] for item in sampled_traffic]
            t_data.add_series(
                "Cache Hit Ratio (%)",
                [float(item.get("cache_hit_ratio", 0.0)) for item in sampled_traffic],
            )
            t_data.add_series(
                "ALB P95 Latency (ms)",
                [float(item.get("alb_p95_ms", 0.0)) for item in sampled_traffic],
            )
            t_chart = perf_slide.shapes.add_chart(
                XL_CHART_TYPE.LINE_MARKERS,
                Inches(0.7),
                Inches(1.5),
                Inches((slide_w_in - 1.8) / 2),
                Inches(min(5.1, slide_h_in - 2.0)),
                t_data,
            ).chart
            t_chart.has_legend = True
            t_chart.legend.position = XL_LEGEND_POSITION.TOP

        if devops_series:
            sampled_devops = devops_series[-10:]
            d_data = CategoryChartData()
            d_data.categories = [str(item["date"])[5:] for item in sampled_devops]
            d_data.add_series(
                "PRs Merged",
                [float(item.get("prs_merged", 0.0)) for item in sampled_devops],
            )
            d_data.add_series(
                "PR Cycle Time (hrs)",
                [float(item.get("cycle_time_hours", 0.0)) for item in sampled_devops],
            )
            d_chart = perf_slide.shapes.add_chart(
                XL_CHART_TYPE.COLUMN_CLUSTERED,
                Inches(0.9 + (slide_w_in - 1.8) / 2),
                Inches(1.5),
                Inches((slide_w_in - 1.8) / 2),
                Inches(min(5.1, slide_h_in - 2.0)),
                d_data,
            ).chart
            d_chart.has_legend = True
            d_chart.legend.position = XL_LEGEND_POSITION.TOP

    # --- Appended Slide C: Actionable Insights & Remediation Matrix Table ---
    if include_insights and insights:
        ins_slide = prs.slides.add_slide(layout)
        hdr = ins_slide.shapes.add_textbox(Inches(0.7), Inches(0.4), Inches(slide_w_in - 1.4), Inches(0.85))
        htf = hdr.text_frame
        hp = htf.paragraphs[0]
        hp.text = "Actionable Insights & Prioritized Remediation Matrix"
        hp.font.size = Pt(24)
        hp.font.bold = True
        hp.font.color.rgb = TEXT_DARK

        subp = htf.add_paragraph()
        subp.text = f"Top {min(len(insights), 6)} cross-product recommendations ordered by severity and financial impact"
        subp.font.size = Pt(12)
        subp.font.color.rgb = RGBColor(71, 85, 105)

        top_rows = insights[:6]
        rows_count = len(top_rows) + 1
        cols_count = 5
        table_shape = ins_slide.shapes.add_table(
            rows_count,
            cols_count,
            Inches(0.7),
            Inches(1.35),
            Inches(slide_w_in - 1.4),
            Inches(min(5.4, slide_h_in - 1.8)),
        )
        table = table_shape.table

        headers = ["Provider", "Severity", "Finding Title", "Actionable Recommendation", "Est. Savings"]
        for c_idx, h_text in enumerate(headers):
            cell = table.cell(0, c_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = NAVY_BG
            cell.text = h_text
            for p in cell.text_frame.paragraphs:
                p.font.size = Pt(11)
                p.font.bold = True
                p.font.color.rgb = TEXT_WHITE

        for r_idx, ins in enumerate(top_rows, start=1):
            savings_txt = (
                f"${float(ins['estimated_savings_usd']):,.0f}/mo"
                if float(ins["estimated_savings_usd"]) > 0
                else "Risk Reduction"
            )
            row_vals = [
                ins["provider_id"].upper(),
                ins["severity"].upper(),
                ins["title"],
                ins["recommendation"],
                savings_txt,
            ]
            for c_idx, val in enumerate(row_vals):
                cell = table.cell(r_idx, c_idx)
                cell.fill.solid()
                cell.fill.fore_color.rgb = (
                    RGBColor(241, 245, 249) if r_idx % 2 == 1 else RGBColor(255, 255, 255)
                )
                cell.text = val
                for p in cell.text_frame.paragraphs:
                    p.font.size = Pt(10)
                    p.font.color.rgb = TEXT_DARK
                    if c_idx == 1 and ins["severity"] in ("critical", "high"):
                        p.font.bold = True
                        p.font.color.rgb = CRIT_RED

    report_id = f"rep-{uuid.uuid4().hex[:10]}"
    slug = re.sub(r"[^a-zA-Z0-9_-]", "_", title.lower())[:36].strip("_") or "cloud_report"
    filename = f"{slug}_{report_id}.pptx"
    export_path = DATA_DIR / "exports" / filename
    prs.save(str(export_path))

    created = now_iso()
    slide_total = len(prs.slides)

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO report_exports
            (id, title, subtitle, template_id, template_name, providers_json, domains_json, filename, file_path, slide_count, placeholders_replaced_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report_id,
                title,
                subtitle,
                tpl_row["id"],
                template_name,
                json.dumps(providers),
                json.dumps(domains),
                filename,
                str(export_path),
                slide_total,
                json.dumps(used_placeholders),
                created,
            ),
        )
        saved_row = conn.execute(
            "SELECT * FROM report_exports WHERE id = ?", (report_id,)
        ).fetchone()

    return _row_to_report_dict(saved_row)


def _row_to_report_dict(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "subtitle": row["subtitle"],
        "template_id": row["template_id"],
        "template_name": row["template_name"],
        "providers": json.loads(row["providers_json"] or "[]"),
        "domains": json.loads(row["domains_json"] or "[]"),
        "filename": row["filename"],
        "file_path": row["file_path"],
        "slide_count": int(row["slide_count"]),
        "placeholders_replaced": json.loads(row["placeholders_replaced_json"] or "{}"),
        "created_at": row["created_at"],
    }


def list_reports() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM report_exports ORDER BY created_at DESC"
        ).fetchall()
        return [_row_to_report_dict(r) for r in rows]


def get_report(report_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM report_exports WHERE id = ?", (report_id,)
        ).fetchone()
        return _row_to_report_dict(row) if row else None
