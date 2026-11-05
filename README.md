# CloudManager — Multi-Cloud Intelligence, Insights & PowerPoint Reporting

CloudManager is a full-stack cloud management platform that aggregates telemetry across **AWS**, **Cloudflare**, and **GitHub** into a persistent **SQLite** database, surfaces actionable FinOps/SecOps/Performance insights, and generates executive **PowerPoint (`.pptx`)** presentations from custom uploaded templates.

## Key Capabilities

1. **Modular Product Plugin Architecture (`BaseCloudProvider` & `ProviderRegistry`)**
   - Built-in connectors for **AWS** (Cost Explorer, EC2/RDS utilization, SecurityHub/GuardDuty, ALB latency), **Cloudflare** (Edge requests, CDN cache hit ratio, WAF mitigated threats, Workers spend), and **GitHub** (Actions CI/CD minutes & billing, PR velocity/cycle time, Dependabot/Secret Scanning alerts).
   - Supports both **Realistic Demo/Mock Telemetry Mode** (seeded out-of-the-box) and **Live API Credentials Mode** (`boto3` and `httpx`).
   - Adding a new product connector requires only subclassing `BaseCloudProvider` in `backend/app/providers/` and registering it with `ProviderRegistry.register(...)`.

2. **Actionable Insights Engine**
   - Automatically synthesizes prioritized findings (`critical`, `high`, `medium`, `low`) with estimated monthly savings (`$/mo`) and remediation steps.
   - Interactive workflow to mark insights as **Resolved**, **Dismissed**, or **Reopened**.

3. **PowerPoint (`.pptx`) Template & Report Studio**
   - Upload any custom `.pptx` presentation template and automatically inspect its `{{placeholder}}` tags and slide layouts.
   - Replaces `{{placeholder}}` tags (`{{total_spend}}`, `{{potential_savings}}`, `{{aws_spend}}`, `{{cloudflare_requests}}`, `{{top_insight_title}}`, etc.) while preserving slide typography.
   - Appends native PowerPoint stacked column charts, line charts, and prioritized remediation tables using `python-pptx`.

---

## Quick Start

### 1. Start the FastAPI Backend (Port 8000)

```bash
cd backend
./.venv/bin/uvicorn app.main:app --reload --port 8000
```

### 2. Start the React + Vite SPA Frontend (Port 5173)

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

### 3. Run Automated Tests

```bash
./backend/.venv/bin/pytest -c backend/pyproject.toml --rootdir=backend backend/tests/test_api.py
```
