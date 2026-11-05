import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type { PlaceholderSpec, PptxTemplate, ReportRecord } from '../types';

interface ReportsViewProps {
  templates: PptxTemplate[];
  placeholders: PlaceholderSpec[];
  reports: ReportRecord[];
  onUploadTemplate: (name: string, file: File) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onGenerateReport: (payload: {
    title: string;
    subtitle: string;
    template_id: string | null;
    providers: string[];
    domains: string[];
    days: number;
    include_insights: boolean;
    executive_notes: string;
  }) => Promise<ReportRecord>;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  templates,
  placeholders,
  reports,
  onUploadTemplate,
  onDeleteTemplate,
  onGenerateReport,
}) => {
  const [title, setTitle] = useState('Executive Cloud Management Briefing');
  const [subtitle, setSubtitle] = useState(
    'Multi-Cloud Cost, Security, Edge Performance & Engineering Velocity'
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id || ''
  );
  const [selectedProviders, setSelectedProviders] = useState<string[]>([
    'aws',
    'cloudflare',
    'github',
  ]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([
    'cost',
    'security',
    'traffic',
    'devops',
  ]);
  const [days, setDays] = useState<number>(30);
  const [includeInsights, setIncludeInsights] = useState<boolean>(true);
  const [executiveNotes, setExecutiveNotes] = useState<string>(
    'Prioritize AWS m6i.2xlarge Compute Savings Plan and Cloudflare catalog cache normalization.'
  );
  const [generating, setGenerating] = useState(false);

  // Template upload form state
  const [templateName, setTemplateName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const toggleItem = (list: string[], value: string, setter: (v: string[]) => void) => {
    if (list.includes(value)) {
      if (list.length > 1) setter(list.filter((i) => i !== value));
    } else {
      setter([...list, value]);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setStatusBanner(null);
    try {
      const created = await onGenerateReport({
        title,
        subtitle,
        template_id: selectedTemplateId || null,
        providers: selectedProviders,
        domains: selectedDomains,
        days,
        include_insights: includeInsights,
        executive_notes: executiveNotes,
      });
      setStatusBanner(
        `Generated "${created.filename}" (${created.slide_count} slides) with ${
          Object.keys(created.placeholders_replaced).length
        } dynamic placeholder tags populated.`
      );
    } catch (err) {
      setStatusBanner(
        `Error generating report: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    setStatusBanner(null);
    try {
      await onUploadTemplate(
        templateName.trim() || uploadFile.name.replace(/\.pptx$/i, ''),
        uploadFile
      );
      setTemplateName('');
      setUploadFile(null);
      setStatusBanner('Uploaded and inspected custom PowerPoint template.');
    } catch (err) {
      setStatusBanner(
        `Template upload failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {statusBanner && (
        <div
          role="status"
          aria-live="polite"
          className="panel-card"
          style={{
            paddingBlock: '0.85rem',
            paddingInline: '1.15rem',
            borderColor: 'var(--brand-accent)',
            backgroundColor: 'var(--bg-elevated)',
            fontWeight: 600,
          }}
        >
          {statusBanner}
        </div>
      )}

      <div className="charts-grid">
        {/* Report Builder Form */}
        <section className="panel-card" aria-label="PowerPoint Report Builder">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Build & Export PowerPoint Presentation (.pptx)</h2>
              <p className="panel-subtitle">
                Populates template <code>{'{{placeholder}}'}</code> tags AND appends native PowerPoint charts & insight tables
              </p>
            </div>
          </div>

          <form className="form-stack" onSubmit={handleReportSubmit} method="POST" action="/api/reports/generate">
            <div className="form-field">
              <label htmlFor="report-title">Presentation Title</label>
              <input
                id="report-title"
                name="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="report-subtitle">Subtitle / Executive Scope</label>
              <input
                id="report-subtitle"
                name="subtitle"
                type="text"
                required
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            {/* Selection Control Decision Matrix: Radio buttons when < 6 options */}
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }} className="form-field">
              <legend style={{ fontSize: '0.875rem', fontWeight: 600, marginBlockEnd: '0.35rem' }}>
                PowerPoint Template (.pptx)
              </legend>
              <div className="radio-group">
                {templates.map((tpl) => (
                  <label key={tpl.id} className="radio-option" style={{ flex: '1 1 220px' }}>
                    <input
                      type="radio"
                      name="template_id"
                      value={tpl.id}
                      checked={(selectedTemplateId || templates[0]?.id) === tpl.id}
                      onChange={() => setSelectedTemplateId(tpl.id)}
                    />
                    <span>
                      <strong>{tpl.name}</strong>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {tpl.slide_count} base slides • {tpl.placeholders.length} tags detected
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }} className="form-field">
              <legend style={{ fontSize: '0.875rem', fontWeight: 600, marginBlockEnd: '0.35rem' }}>
                Included Product Modules
              </legend>
              <div className="radio-group">
                {(['aws', 'cloudflare', 'github'] as const).map((prov) => (
                  <label key={prov} className="radio-option">
                    <input
                      type="checkbox"
                      name="providers"
                      value={prov}
                      checked={selectedProviders.includes(prov)}
                      onChange={() =>
                        toggleItem(selectedProviders, prov, setSelectedProviders)
                      }
                    />
                    <span>{prov.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }} className="form-field">
              <legend style={{ fontSize: '0.875rem', fontWeight: 600, marginBlockEnd: '0.35rem' }}>
                Included Telemetry Domains & Slide Decks
              </legend>
              <div className="radio-group">
                {(['cost', 'security', 'traffic', 'devops'] as const).map((dom) => (
                  <label key={dom} className="radio-option">
                    <input
                      type="checkbox"
                      name="domains"
                      value={dom}
                      checked={selectedDomains.includes(dom)}
                      onChange={() => toggleItem(selectedDomains, dom, setSelectedDomains)}
                    />
                    <span>{dom.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }} className="form-field">
              <legend style={{ fontSize: '0.875rem', fontWeight: 600, marginBlockEnd: '0.35rem' }}>
                Reporting Horizon
              </legend>
              <div className="radio-group">
                {[14, 30].map((d) => (
                  <label key={d} className="radio-option">
                    <input
                      type="radio"
                      name="days"
                      value={d}
                      checked={days === d}
                      onChange={() => setDays(d)}
                    />
                    <span>Last {d} Days</span>
                  </label>
                ))}
                <label className="radio-option">
                  <input
                    type="checkbox"
                    name="include_insights"
                    checked={includeInsights}
                    onChange={(e) => setIncludeInsights(e.target.checked)}
                  />
                  <span>Append Remediation Matrix Slide</span>
                </label>
              </div>
            </fieldset>

            <div className="form-field">
              <label htmlFor="exec-notes">Executive Commentary (<code>{'{{executive_notes}}'}</code>)</label>
              <textarea
                id="exec-notes"
                name="executive_notes"
                rows={2}
                value={executiveNotes}
                onChange={(e) => setExecutiveNotes(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={generating}>
              <Sparkles size={16} />
              {generating
                ? 'Synthesizing PowerPoint Deck...'
                : 'Generate & Save PowerPoint Presentation'}
            </button>
          </form>
        </section>

        {/* Custom PowerPoint Template Manager & Placeholder Inspector */}
        <section className="panel-card" aria-label="PowerPoint Template Manager">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">PowerPoint Template Studio (.pptx)</h2>
              <p className="panel-subtitle">
                Upload a branded corporate <code>.pptx</code> template. Any <code>{'{{tag}}'}</code> in your slides will be automatically replaced.
              </p>
            </div>
          </div>

          <form
            className="form-stack"
            onSubmit={handleUploadSubmit}
            method="POST"
            action="/api/templates/upload"
          >
            <div className="form-field">
              <label htmlFor="tpl-name">Template Display Name</label>
              <input
                id="tpl-name"
                name="name"
                type="text"
                placeholder="e.g. Q4 Board Deck Template"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="tpl-file">Upload PowerPoint (.pptx) File</label>
              <input
                id="tpl-file"
                name="file"
                type="file"
                accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                required
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>

            <button type="submit" className="btn" disabled={uploading || !uploadFile}>
              <Upload size={16} />
              {uploading ? 'Parsing Template Slides...' : 'Upload & Inspect .pptx Template'}
            </button>
          </form>

          {/* Active Templates List */}
          <div style={{ marginBlockStart: '0.75rem' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBlockEnd: '0.5rem' }}>
              Available PowerPoint Templates ({templates.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  style={{
                    padding: '0.8rem',
                    borderRadius: '0.6rem',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-canvas)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      <Layers
                        size={14}
                        style={{ verticalAlign: 'middle', marginInlineEnd: '0.35rem' }}
                      />
                      {tpl.name}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <a
                        href={`/api/templates/${tpl.id}/download`}
                        className="btn"
                        style={{ paddingBlock: '0.25rem', paddingInline: '0.55rem', fontSize: '0.75rem' }}
                        download
                      >
                        <Download size={13} />
                        Download .pptx
                      </a>
                      {!tpl.is_default && (
                        <button
                          type="button"
                          className="btn"
                          style={{ paddingBlock: '0.25rem', paddingInline: '0.5rem', fontSize: '0.75rem' }}
                          onClick={() => onDeleteTemplate(tpl.id)}
                          aria-label={`Delete template ${tpl.name}`}
                        >
                          <Trash2 size={13} color="var(--danger-color)" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Detected Tags ({tpl.placeholders.length}):{' '}
                    {tpl.placeholders.length > 0
                      ? tpl.placeholders.map((t) => (
                          <code
                            key={t}
                            className="tag-code"
                            style={{ marginInlineEnd: '0.3rem', display: 'inline-block', marginBlockEnd: '0.2rem' }}
                          >
                            {`{{${t}}}`}
                          </code>
                        ))
                      : 'No {{tags}} in base slides (charts & tables will still be appended)'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supported Placeholders Reference */}
          <details style={{ marginBlockStart: '0.5rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: 'var(--brand-accent)',
              }}
            >
              View All {placeholders.length} Supported Template Placeholder Tags
            </summary>
            <div
              style={{
                marginBlockStart: '0.6rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '0.45rem',
                maxBlockSize: '210px',
                overflowY: 'auto',
                padding: '0.5rem',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: '0.5rem',
              }}
            >
              {placeholders.map((ph) => (
                <div key={ph.tag} style={{ fontSize: '0.75rem' }}>
                  <code className="tag-code">{ph.tag}</code>
                  <div style={{ color: 'var(--text-secondary)', marginBlockStart: '0.1rem' }}>
                    {ph.description}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </section>
      </div>

      {/* Generated PowerPoint Reports Archive Table */}
      <section className="panel-card" aria-label="Generated PowerPoint Decks">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Generated PowerPoint Presentations Archive</h2>
            <p className="panel-subtitle">
              Download ready-to-present <code>.pptx</code> decks persisted in SQLite & disk storage
            </p>
          </div>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="reports-history-caption"
          className="table-wrapper"
        >
          <table>
            <caption id="reports-history-caption">
              Historical PowerPoint report exports ({reports.length} presentations)
            </caption>
            <thead>
              <tr>
                <th>Presentation Title</th>
                <th>Template Used</th>
                <th>Included Products</th>
                <th>Slides & Replaced Tags</th>
                <th>Created (UTC)</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <th colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No PowerPoint presentations generated yet. Click &ldquo;Generate &amp; Save PowerPoint Presentation&rdquo; above to build your first deck.
                  </th>
                </tr>
              ) : (
                reports.map((rep) => (
                  <tr key={rep.id}>
                    <th>
                      <div style={{ fontWeight: 600 }}>{rep.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                        {rep.subtitle}
                      </div>
                    </th>
                    <td>{rep.template_name}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {rep.providers.map((p) => (
                          <span key={p} className={`badge badge-${p}`}>
                            {p.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <strong>{rep.slide_count} slides</strong> •{' '}
                      {Object.keys(rep.placeholders_replaced).length} tags populated
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {rep.created_at.replace('T', ' ').replace('Z', '')}
                    </td>
                    <td>
                      <a
                        href={`/api/reports/${rep.id}/download`}
                        className="btn btn-primary"
                        style={{ paddingBlock: '0.35rem', paddingInline: '0.75rem', fontSize: '0.8rem' }}
                        download
                      >
                        <FileSpreadsheet size={14} />
                        Download .pptx
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
