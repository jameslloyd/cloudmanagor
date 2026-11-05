"""End-to-end tests for CloudManager Backend (Providers, SQLite persistence, and PowerPoint engine)."""

from __future__ import annotations

import io
from pathlib import Path
from fastapi.testclient import TestClient
from pptx import Presentation

from app.main import app


def test_full_cloudmanager_workflow() -> None:
    with TestClient(app) as client:
        # 1. Health check
        r_health = client.get("/api/health")
        assert r_health.status_code == 200
        assert r_health.json()["status"] == "ok"

        # 2. Provider catalog check (modular registry)
        r_cat = client.get("/api/providers/catalog")
        assert r_cat.status_code == 200
        catalog = r_cat.json()
        provider_ids = {p["provider_id"] for p in catalog}
        assert {"aws", "cloudflare", "github"}.issubset(provider_ids)

        # 3. Default seeded connections & dashboard overview
        r_dash = client.get("/api/dashboard/overview?days=30")
        assert r_dash.status_code == 200
        dash = r_dash.json()
        assert dash["kpis"]["total_spend_usd"] > 0
        assert dash["kpis"]["open_insights_count"] >= 5
        assert len(dash["series"]["cost"]) == 30
        assert len(dash["insights"]) >= 5

        # 4. Update insight status
        first_insight_id = dash["insights"][0]["id"]
        r_ins = client.patch(
            f"/api/insights/{first_insight_id}",
            json={"status": "resolved"},
        )
        assert r_ins.status_code == 200
        assert r_ins.json()["status"] == "resolved"

        # 5. Create custom PowerPoint template in-memory with {{placeholders}} and upload it
        custom_prs = Presentation()
        slide = custom_prs.slides.add_slide(custom_prs.slide_layouts[0])
        slide.shapes.title.text = "Board Deck: {{report_title}}"
        slide.placeholders[1].text = "Total Spend: {{total_spend}} | Savings: {{potential_savings}}"
        buf = io.BytesIO()
        custom_prs.save(buf)
        buf.seek(0)

        r_tpl = client.post(
            "/api/templates/upload",
            data={"name": "Board Custom Template"},
            files={
                "file": (
                    "board_template.pptx",
                    buf.getvalue(),
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                )
            },
        )
        assert r_tpl.status_code == 200
        tpl_data = r_tpl.json()
        assert "report_title" in tpl_data["placeholders"]
        assert "total_spend" in tpl_data["placeholders"]
        assert "potential_savings" in tpl_data["placeholders"]

        # 6. Generate PowerPoint report using the uploaded custom template
        r_rep = client.post(
            "/api/reports/generate",
            json={
                "title": "Q4 Cloud Executive Review",
                "subtitle": "AWS, Cloudflare & GitHub Posture",
                "template_id": tpl_data["id"],
                "providers": ["aws", "cloudflare", "github"],
                "domains": ["cost", "security", "traffic", "devops"],
                "days": 30,
                "include_insights": True,
                "executive_notes": "Approved EC2 Savings Plan purchase for Q4.",
            },
        )
        assert r_rep.status_code == 200
        rep_data = r_rep.json()
        assert rep_data["slide_count"] >= 4
        assert rep_data["placeholders_replaced"]["report_title"] == "Q4 Cloud Executive Review"

        # 7. Download generated PPTX and verify slide text replacement
        r_dl = client.get(f"/api/reports/{rep_data['id']}/download")
        assert r_dl.status_code == 200
        exported_prs = Presentation(io.BytesIO(r_dl.content))
        slide0_text = "\n".join(
            shape.text for shape in exported_prs.slides[0].shapes if shape.has_text_frame
        )
        assert "Q4 Cloud Executive Review" in slide0_text
        assert "$" in slide0_text
