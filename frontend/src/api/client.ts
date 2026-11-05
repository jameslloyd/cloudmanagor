import type {
  DashboardOverview,
  InsightItem,
  PlaceholderSpec,
  PptxTemplate,
  ProviderConnection,
  ProviderMetadata,
  ReportRecord,
} from '../types';

const API_BASE = '/api';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let errText = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      errText = data.detail || errText;
    } catch {
      // ignore json parse error
    }
    throw new Error(errText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getDashboardOverview: (providers: string[], domains: string[], days: number) => {
    const params = new URLSearchParams();
    if (providers.length > 0) params.set('providers', providers.join(','));
    if (domains.length > 0) params.set('domains', domains.join(','));
    params.set('days', String(days));
    return requestJson<DashboardOverview>(`${API_BASE}/dashboard/overview?${params.toString()}`);
  },

  getProviderCatalog: () =>
    requestJson<ProviderMetadata[]>(`${API_BASE}/providers/catalog`),

  getConnections: () =>
    requestJson<ProviderConnection[]>(`${API_BASE}/connections`),

  createConnection: (payload: {
    provider_id: string;
    name: string;
    mode: 'mock' | 'live';
    credentials: Record<string, string>;
  }) =>
    requestJson<ProviderConnection>(`${API_BASE}/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  updateConnection: (
    connectionId: string,
    payload: {
      name?: string;
      mode?: 'mock' | 'live';
      credentials?: Record<string, string>;
    }
  ) =>
    requestJson<ProviderConnection>(`${API_BASE}/connections/${connectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  deleteConnection: (connectionId: string) =>
    requestJson<{ deleted: boolean }>(`${API_BASE}/connections/${connectionId}`, {
      method: 'DELETE',
    }),

  syncConnection: (connectionId: string, days = 30) =>
    requestJson<{
      connection_id: string;
      provider_id: string;
      metrics_ingested: number;
      insights_generated: number;
      message: string;
    }>(`${API_BASE}/connections/${connectionId}/sync?days=${days}`, {
      method: 'POST',
    }),

  syncAllConnections: (days = 30) =>
    requestJson<
      Array<{
        connection_id: string;
        provider_id: string;
        metrics_ingested: number;
        insights_generated: number;
        message: string;
      }>
    >(`${API_BASE}/connections/sync-all?days=${days}`, {
      method: 'POST',
    }),

  updateInsightStatus: (
    insightId: string,
    status: 'open' | 'resolved' | 'dismissed'
  ) =>
    requestJson<InsightItem>(`${API_BASE}/insights/${insightId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),

  getTemplates: () => requestJson<PptxTemplate[]>(`${API_BASE}/templates`),

  getPlaceholders: () =>
    requestJson<PlaceholderSpec[]>(`${API_BASE}/templates/placeholders`),

  uploadTemplate: (name: string, file: File) => {
    const form = new FormData();
    form.append('name', name);
    form.append('file', file);
    return requestJson<PptxTemplate>(`${API_BASE}/templates/upload`, {
      method: 'POST',
      body: form,
    });
  },

  deleteTemplate: (templateId: string) =>
    requestJson<{ deleted: boolean }>(`${API_BASE}/templates/${templateId}`, {
      method: 'DELETE',
    }),

  getReports: () => requestJson<ReportRecord[]>(`${API_BASE}/reports`),

  generateReport: (payload: {
    title: string;
    subtitle: string;
    template_id: string | null;
    providers: string[];
    domains: string[];
    days: number;
    include_insights: boolean;
    executive_notes: string;
  }) =>
    requestJson<ReportRecord>(`${API_BASE}/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};
