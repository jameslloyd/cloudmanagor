import React, { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  FileSpreadsheet,
  LayoutDashboard,
  Lightbulb,
  Moon,
  PlugZap,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { api } from './api/client';
import { ConnectorsView } from './components/ConnectorsView';
import { DashboardView } from './components/DashboardView';
import { InsightsView } from './components/InsightsView';
import { ReportsView } from './components/ReportsView';
import type {
  DashboardOverview,
  PlaceholderSpec,
  PptxTemplate,
  ProviderMetadata,
  ReportRecord,
} from './types';

type ActiveTab = 'dashboard' | 'insights' | 'reports' | 'connectors';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [selectedProviders, setSelectedProviders] = useState<string[]>([
    'aws',
    'cloudflare',
    'github',
  ]);
  const [days, setDays] = useState<number>(30);

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [catalog, setCatalog] = useState<ProviderMetadata[]>([]);
  const [templates, setTemplates] = useState<PptxTemplate[]>([]);
  const [placeholders, setPlaceholders] = useState<PlaceholderSpec[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [syncingAll, setSyncingAll] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [ov, cat, tpls, phs, reps] = await Promise.all([
        api.getDashboardOverview(
          selectedProviders,
          ['cost', 'security', 'traffic', 'devops'],
          days
        ),
        api.getProviderCatalog(),
        api.getTemplates(),
        api.getPlaceholders(),
        api.getReports(),
      ]);
      setOverview(ov);
      setCatalog(cat);
      setTemplates(tpls);
      setPlaceholders(phs);
      setReports(reps);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedProviders, days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleProvider = (providerId: string) => {
    setSelectedProviders((prev) => {
      if (prev.includes(providerId)) {
        return prev.length > 1 ? prev.filter((p) => p !== providerId) : prev;
      }
      return [...prev, providerId];
    });
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      await api.syncAllConnections(days);
      await loadData();
    } finally {
      setSyncingAll(false);
    }
  };

  const handleUpdateInsightStatus = async (
    id: string,
    status: 'open' | 'resolved' | 'dismissed'
  ) => {
    await api.updateInsightStatus(id, status);
    await loadData();
  };

  const handleUploadTemplate = async (name: string, file: File) => {
    await api.uploadTemplate(name, file);
    const updatedTemplates = await api.getTemplates();
    setTemplates(updatedTemplates);
  };

  const handleDeleteTemplate = async (id: string) => {
    await api.deleteTemplate(id);
    const updatedTemplates = await api.getTemplates();
    setTemplates(updatedTemplates);
  };

  const handleGenerateReport = async (payload: {
    title: string;
    subtitle: string;
    template_id: string | null;
    providers: string[];
    domains: string[];
    days: number;
    include_insights: boolean;
    executive_notes: string;
  }) => {
    const report = await api.generateReport(payload);
    const updatedReports = await api.getReports();
    setReports(updatedReports);
    return report;
  };

  const openInsightsCount =
    overview?.insights.filter((i) => i.status === 'open').length || 0;

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar" aria-label="Primary Navigation">
        <div className="brand-lockup">
          <div className="brand-icon" aria-hidden="true">
            <Cloud size={22} />
          </div>
          <div>
            <h1 className="brand-title">CloudManager</h1>
            <p className="brand-subtitle">Multi-Cloud & PPTX Studio</p>
          </div>
        </div>

        <nav aria-label="Workspace Sections">
          <ul className="nav-list">
            <li>
              <button
                type="button"
                className="nav-btn"
                aria-current={activeTab === 'dashboard' ? 'page' : undefined}
                onClick={() => setActiveTab('dashboard')}
              >
                <LayoutDashboard size={18} />
                <span>Executive Overview</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="nav-btn"
                aria-current={activeTab === 'insights' ? 'page' : undefined}
                onClick={() => setActiveTab('insights')}
              >
                <Lightbulb size={18} />
                <span>Actionable Insights</span>
                {openInsightsCount > 0 && (
                  <span className="nav-badge">{openInsightsCount}</span>
                )}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="nav-btn"
                aria-current={activeTab === 'reports' ? 'page' : undefined}
                onClick={() => setActiveTab('reports')}
              >
                <FileSpreadsheet size={18} />
                <span>PowerPoint Studio</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="nav-btn"
                aria-current={activeTab === 'connectors' ? 'page' : undefined}
                onClick={() => setActiveTab('connectors')}
              >
                <PlugZap size={18} />
                <span>Product Connectors</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <strong>SQLite Persistent Storage</strong>
            <div>AWS • Cloudflare • GitHub</div>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-area">
        <header className="top-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              {activeTab === 'dashboard' && 'Multi-Cloud Management & Trend Intelligence'}
              {activeTab === 'insights' && 'Actionable FinOps, SecOps & Performance Insights'}
              {activeTab === 'reports' && 'PowerPoint (.pptx) Template & Report Studio'}
              {activeTab === 'connectors' && 'Modular Product Connectors (AWS, Cloudflare, GitHub)'}
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Unified telemetry across cloud infrastructure, edge security, and engineering pipelines
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn"
              onClick={handleSyncAll}
              disabled={syncingAll}
            >
              <RefreshCw size={15} />
              {syncingAll ? 'Syncing All Providers...' : 'Sync All Telemetry'}
            </button>
            {activeTab !== 'reports' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveTab('reports')}
              >
                <FileSpreadsheet size={15} />
                Build PPTX Report
              </button>
            )}
          </div>
        </header>

        <main className="workspace-content">
          {error && (
            <div
              role="alert"
              className="panel-card"
              style={{
                borderColor: 'var(--danger-color)',
                color: 'var(--danger-color)',
              }}
            >
              <strong>Backend Connection Error:</strong> {error}
            </div>
          )}

          {loading || !overview ? (
            <div className="panel-card" style={{ padding: '3rem', textAlign: 'center' }}>
              Loading multi-cloud telemetry from SQLite...
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  overview={overview}
                  selectedProviders={selectedProviders}
                  onToggleProvider={handleToggleProvider}
                  days={days}
                  onChangeDays={setDays}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onUpdateInsightStatus={handleUpdateInsightStatus}
                />
              )}

              {activeTab === 'insights' && (
                <InsightsView
                  insights={overview.insights}
                  onUpdateStatus={handleUpdateInsightStatus}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  templates={templates}
                  placeholders={placeholders}
                  reports={reports}
                  onUploadTemplate={handleUploadTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  onGenerateReport={handleGenerateReport}
                />
              )}

              {activeTab === 'connectors' && (
                <ConnectorsView
                  catalog={catalog}
                  connections={overview.connections}
                  onCreateConnection={async (payload) => {
                    await api.createConnection(payload);
                    await loadData();
                  }}
                  onUpdateConnection={async (id, payload) => {
                    await api.updateConnection(id, payload);
                    await loadData();
                  }}
                  onDeleteConnection={async (id) => {
                    await api.deleteConnection(id);
                    await loadData();
                  }}
                  onSyncConnection={async (id) => {
                    await api.syncConnection(id, days);
                    await loadData();
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
