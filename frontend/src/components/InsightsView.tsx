import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { InsightItem } from '../types';

interface InsightsViewProps {
  insights: InsightItem[];
  onUpdateStatus: (id: string, status: 'open' | 'resolved' | 'dismissed') => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  insights,
  onUpdateStatus,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved' | 'dismissed'>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');

  const filtered = insights.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (domainFilter !== 'all' && item.domain !== domainFilter) return false;
    return true;
  });

  const totalOpenSavings = insights
    .filter((i) => i.status === 'open')
    .reduce((acc, cur) => acc + cur.estimated_savings_usd, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <section className="panel-card" aria-label="Insights Summary and Filters">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Actionable Insights & Optimization Engine</h2>
            <p className="panel-subtitle">
              Track, remediate, and verify FinOps, SecOps, Edge Caching, and CI/CD recommendations
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              paddingBlock: '0.45rem',
              paddingInline: '0.9rem',
              borderRadius: '0.6rem',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--emerald-color)',
              fontWeight: 700,
              fontSize: '0.9rem',
            }}
          >
            <Sparkles size={16} />
            Open Savings Opportunity: ${totalOpenSavings.toLocaleString()}/month
          </div>
        </div>

        <div className="panel-header" style={{ paddingBlockStart: '0.5rem' }}>
          <div className="pill-bar" role="group" aria-label="Filter by status">
            {(['all', 'open', 'resolved', 'dismissed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className="filter-pill"
                aria-pressed={statusFilter === st}
                onClick={() => setStatusFilter(st)}
              >
                {st.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="pill-bar" role="group" aria-label="Filter by domain">
            {(['all', 'cost', 'security', 'traffic', 'devops'] as const).map((dom) => (
              <button
                key={dom}
                type="button"
                className="filter-pill"
                aria-pressed={domainFilter === dom}
                onClick={() => setDomainFilter(dom)}
              >
                {dom === 'all' ? 'All Domains' : dom.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel-card" aria-label="Insights Table">
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="all-insights-table-caption"
          className="table-wrapper"
        >
          <table>
            <caption id="all-insights-table-caption">
              Complete list of detected cloud management insights ({filtered.length} matching findings)
            </caption>
            <thead>
              <tr>
                <th>Insight & Technical Summary</th>
                <th>Product & Domain</th>
                <th>Severity</th>
                <th>Prescribed Remediation</th>
                <th>Est. Monthly Impact</th>
                <th>Status & Workflow</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <th style={{ maxInlineSize: '340px' }}>
                    <div style={{ fontWeight: 600, marginBlockEnd: '0.3rem' }}>
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 400,
                        lineHeight: 1.45,
                      }}
                    >
                      {item.summary}
                    </div>
                  </th>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                      <span className={`badge badge-${item.provider_id}`}>
                        {item.provider_id.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Domain: {item.domain.toUpperCase()}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${item.severity}`}>
                      {item.severity === 'critical' ? (
                        <ShieldAlert size={12} />
                      ) : (
                        <AlertTriangle size={12} />
                      )}
                      {item.severity}
                    </span>
                  </td>
                  <td style={{ maxInlineSize: '340px', lineHeight: 1.45 }}>
                    <div>{item.recommendation}</div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        marginBlockStart: '0.3rem',
                      }}
                    >
                      <strong>Expected Outcome:</strong> {item.impact}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--emerald-color)' }}>
                    {item.estimated_savings_usd > 0
                      ? `$${item.estimated_savings_usd.toLocaleString()}/mo`
                      : 'Security Hardening'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color:
                            item.status === 'resolved'
                              ? 'var(--emerald-color)'
                              : item.status === 'dismissed'
                              ? 'var(--text-secondary)'
                              : 'var(--brand-accent)',
                        }}
                      >
                        • {item.status}
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {item.status !== 'resolved' && (
                          <button
                            type="button"
                            className="btn"
                            style={{ paddingBlock: '0.3rem', paddingInline: '0.55rem', fontSize: '0.75rem' }}
                            onClick={() => onUpdateStatus(item.id, 'resolved')}
                          >
                            <CheckCircle2 size={13} color="var(--emerald-color)" />
                            Resolve
                          </button>
                        )}
                        {item.status === 'open' && (
                          <button
                            type="button"
                            className="btn"
                            style={{ paddingBlock: '0.3rem', paddingInline: '0.55rem', fontSize: '0.75rem' }}
                            onClick={() => onUpdateStatus(item.id, 'dismissed')}
                          >
                            <XCircle size={13} />
                            Dismiss
                          </button>
                        )}
                        {item.status !== 'open' && (
                          <button
                            type="button"
                            className="btn"
                            style={{ paddingBlock: '0.3rem', paddingInline: '0.55rem', fontSize: '0.75rem' }}
                            onClick={() => onUpdateStatus(item.id, 'open')}
                          >
                            <RotateCcw size={13} />
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
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
