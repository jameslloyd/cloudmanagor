export interface CredentialFieldSchema {
  key: string;
  label: string;
  field_type: 'text' | 'password' | 'select';
  required: boolean;
  placeholder: string;
  help_text: string;
}

export interface ProviderMetadata {
  provider_id: string;
  display_name: string;
  description: string;
  category: string;
  supported_domains: string[];
  credential_fields: CredentialFieldSchema[];
}

export interface ProviderConnection {
  id: string;
  provider_id: string;
  name: string;
  mode: 'mock' | 'live';
  status: string;
  last_synced_at: string | null;
  created_at: string;
  has_credentials: boolean;
}

export interface InsightItem {
  id: string;
  provider_id: string;
  connection_id: string;
  domain: 'cost' | 'security' | 'traffic' | 'devops';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  recommendation: string;
  impact: string;
  estimated_savings_usd: number;
  status: 'open' | 'resolved' | 'dismissed';
  detected_at: string;
}

export interface DashboardKPIs {
  total_spend_usd: number;
  spend_trend_pct: number;
  potential_monthly_savings_usd: number;
  open_insights_count: number;
  critical_high_alerts: number;
  total_requests: number;
  avg_cache_hit_ratio: number;
  avg_alb_p95_latency_ms: number;
  github_actions_minutes: number;
  github_prs_merged: number;
  provider_spend_breakdown: Record<string, number>;
}

export interface DashboardOverview {
  kpis: DashboardKPIs;
  series: {
    cost: Array<{
      date: string;
      aws: number;
      cloudflare: number;
      github: number;
      total: number;
    }>;
    traffic: Array<{
      date: string;
      aws_requests: number;
      cf_requests: number;
      cache_hit_ratio: number;
      alb_p95_ms: number;
    }>;
    devops: Array<{
      date: string;
      actions_minutes: number;
      prs_merged: number;
      cycle_time_hours: number;
    }>;
    security: Array<{
      date: string;
      aws_findings: number;
      cf_waf_threats: number;
      gh_alerts: number;
    }>;
  };
  insights: InsightItem[];
  connections: ProviderConnection[];
}

export interface PptxTemplate {
  id: string;
  name: string;
  filename: string;
  is_default: boolean;
  placeholders: string[];
  slide_count: number;
  layout_names: string[];
  created_at: string;
}

export interface PlaceholderSpec {
  tag: string;
  description: string;
}

export interface ReportRecord {
  id: string;
  title: string;
  subtitle: string;
  template_id: string | null;
  template_name: string;
  providers: string[];
  domains: string[];
  filename: string;
  slide_count: number;
  placeholders_replaced: Record<string, string>;
  created_at: string;
}
