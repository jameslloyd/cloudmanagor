import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  GitPullRequest,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type { DashboardOverview } from '../types';

interface DashboardViewProps {
  overview: DashboardOverview;
  selectedProviders: string[];
  onToggleProvider: (providerId: string) => void;
  days: number;
  onChangeDays: (days: number) => void;
  onNavigateTab: (tab: 'insights' | 'reports' | 'connectors') => void;
  onUpdateInsightStatus: (id: string, status: 'open' | 'resolved' | 'dismissed') => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  aws: 'AWS',
  cloudflare: 'Cloudflare',
  github: 'GitHub',
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  overview,
  selectedProviders,
  onToggleProvider,
  days,
  onChangeDays,
  onNavigateTab,
  onUpdateInsightStatus,
}) => {
  const { kpis, series, insights } = overview;
  const openInsights = insights.filter((i) => i.status === 'open');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Filter Bar */}
      <section
        className="panel-card"
        style={{ paddingBlock: '0.9rem', paddingInline: '1.25rem' }}
        aria-label="Telemetry Filters"
      >
        <div className="panel-header">
          <div className="pill-bar" role="group" aria-label="Filter by product provider">
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginInlineEnd: '0.25rem',
              }}
            >
              Active Products:
            </span>
            {(['aws', 'cloudflare', 'github'] as const).map((prov) => {
              const active = selectedProviders.includes(prov);
              return (
                <button
                  key={prov}
                  type="button"
                  className="filter-pill"
                  aria-pressed={active}
                  onClick={() => onToggleProvider(prov)}
                >
                  {PROVIDER_LABELS[prov]}
                </button>
              );
            })}
          </div>

          <div className="pill-bar" role="group" aria-label="Time horizon">
            {[14, 30].map((d) => (
              <button
                key={d}
                type="button"
                className="filter-pill"
                aria-pressed={days === d}
                onClick={() => onChangeDays(d)}
              >
                Last {d} Days
              </button>
            ))}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigateTab('reports')}
            >
              <FileSpreadsheet size={16} />
              Export to PowerPoint
            </button>
          </div>
        </div>
      </section>

      {/* Executive KPI Summary Cards */}
      <section className="kpi-grid dashboard-section" aria-label="Key Performance Indicators">
        <article className="kpi-card">
          <div className="kpi-label">
            <span>Total {days}-Day Spend</span>
            <DollarSign size={16} color="var(--brand-accent)" />
          </div>
          <div className="kpi-value">
            ${kpis.total_spend_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="kpi-subtext">
            {kpis.spend_trend_pct >= 0 ? (
              <ArrowUpRight size={15} color="#f59e0b" />
            ) : (
              <ArrowDownRight size={15} color="#10b981" />
            )}
            <span>
              {kpis.spend_trend_pct >= 0 ? `+${kpis.spend_trend_pct}%` : `${kpis.spend_trend_pct}%`}{' '}
              vs prior 7d
            </span>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-label">
            <span>Actionable Savings</span>
            <Sparkles size={16} color="var(--emerald-color)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--emerald-color)' }}>
            ${kpis.potential_monthly_savings_usd.toLocaleString()}/mo
          </div>
          <div className="kpi-subtext">
            <span>Across {kpis.open_insights_count} active optimization findings</span>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-label">
            <span>Critical & High Alerts</span>
            <ShieldAlert size={16} color="var(--danger-color)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--danger-color)' }}>
            {kpis.critical_high_alerts}
          </div>
          <div className="kpi-subtext">
            <span>AWS SecurityHub, Cloudflare WAF & Dependabot</span>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-label">
            <span>Edge & ALB Requests</span>
            <Activity size={16} color="var(--cloudflare-color)" />
          </div>
          <div className="kpi-value">
            {(kpis.total_requests / 1_000_000).toFixed(1)}M
          </div>
          <div className="kpi-subtext">
            <span>
              CDN Cache Hit: <strong>{kpis.avg_cache_hit_ratio}%</strong> • ALB P95:{' '}
              <strong>{kpis.avg_alb_p95_latency_ms}ms</strong>
            </span>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-label">
            <span>Engineering Velocity</span>
            <GitPullRequest size={16} color="var(--github-color)" />
          </div>
          <div className="kpi-value">{kpis.github_prs_merged} PRs</div>
          <div className="kpi-subtext">
            <span>
              {kpis.github_actions_minutes.toLocaleString()} GitHub Actions runner mins
            </span>
          </div>
        </article>
      </section>

      {/* Multi-Cloud Trend Charts */}
      <section className="charts-grid dashboard-section" aria-label="Multi-Cloud Trend Charts">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Multi-Cloud Daily Spend Trend (USD)</h2>
              <p className="panel-subtitle">
                Stacked cost trajectory across AWS, Cloudflare Edge, and GitHub Actions
              </p>
            </div>
          </div>
          <div style={{ inlineSize: '100%', blockSize: 290 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.cost}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(2)}`, undefined]}
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '0.5rem',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="aws"
                  name="AWS Spend"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.35}
                />
                <Area
                  type="monotone"
                  dataKey="cloudflare"
                  name="Cloudflare Spend"
                  stackId="1"
                  stroke="#f97316"
                  fill="#f97316"
                  fillOpacity={0.35}
                />
                <Area
                  type="monotone"
                  dataKey="github"
                  name="GitHub Spend"
                  stackId="1"
                  stroke="#a855f7"
                  fill="#a855f7"
                  fillOpacity={0.35}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Edge Cache Efficiency & AWS Origin Latency</h2>
              <p className="panel-subtitle">
                Cloudflare CDN Cache Hit Ratio (%) vs. AWS ALB P95 Target Latency (ms)
              </p>
            </div>
          </div>
          <div style={{ inlineSize: '100%', blockSize: 290 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.traffic}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '0.5rem',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cache_hit_ratio"
                  name="CDN Cache Hit (%)"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="alb_p95_ms"
                  name="AWS ALB P95 Latency (ms)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">GitHub Engineering Velocity & CI/CD Load</h2>
              <p className="panel-subtitle">
                Daily Pull Requests Merged vs. PR Merge Cycle Time (Hours)
              </p>
            </div>
          </div>
          <div style={{ inlineSize: '100%', blockSize: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.devops}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '0.5rem',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="prs_merged"
                  name="PRs Merged"
                  fill="#a855f7"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="cycle_time_hours"
                  name="Cycle Time (hrs)"
                  fill="#38bdf8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Security Posture & Threat Telemetry</h2>
              <p className="panel-subtitle">
                AWS SecurityHub Open Findings & GitHub Dependabot Alerts
              </p>
            </div>
          </div>
          <div style={{ inlineSize: '100%', blockSize: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.security}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '0.5rem',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="aws_findings"
                  name="AWS SecurityHub Findings"
                  stroke="#ef4444"
                  strokeWidth={2.2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="gh_alerts"
                  name="GitHub Dependabot Alerts"
                  stroke="#f59e0b"
                  strokeWidth={2.2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      {/* Top Actionable Insights Preview Table */}
      <section className="panel-card dashboard-section" aria-label="Priority Actionable Insights">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Priority Actionable Insights & FinOps/SecOps Recommendations</h2>
            <p className="panel-subtitle">
              Automatically synthesized from AWS, Cloudflare, and GitHub telemetry
            </p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => onNavigateTab('insights')}
          >
            View All Insights ({insights.length})
          </button>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="priority-insights-caption"
          className="table-wrapper"
        >
          <table>
            <caption id="priority-insights-caption">
              Top active cloud management recommendations ordered by severity and financial impact
            </caption>
            <thead>
              <tr>
                <th>Finding & Impact</th>
                <th>Product</th>
                <th>Severity</th>
                <th>Actionable Recommendation</th>
                <th>Est. Savings</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {openInsights.slice(0, 5).map((item) => (
                <tr key={item.id}>
                  <th>
                    <div style={{ fontWeight: 600, marginBlockEnd: '0.25rem' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                      {item.impact}
                    </div>
                  </th>
                  <td>
                    <span className={`badge badge-${item.provider_id}`}>
                      {PROVIDER_LABELS[item.provider_id] || item.provider_id}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${item.severity}`}>
                      <AlertTriangle size={12} />
                      {item.severity}
                    </span>
                  </td>
                  <td style={{ maxInlineSize: '360px' }}>{item.recommendation}</td>
                  <td style={{ fontWeight: 700, color: 'var(--emerald-color)' }}>
                    {item.estimated_savings_usd > 0
                      ? `$${item.estimated_savings_usd.toLocaleString()}/mo`
                      : 'Risk Mitigation'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      style={{ paddingBlock: '0.35rem', paddingInline: '0.65rem', fontSize: '0.78rem' }}
                      onClick={() => onUpdateInsightStatus(item.id, 'resolved')}
                    >
                      <CheckCircle2 size={14} color="var(--emerald-color)" />
                      Mark Resolved
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
