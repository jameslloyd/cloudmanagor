import React, { useId, useRef, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  Server,
  Trash2,
} from 'lucide-react';
import type { ProviderConnection, ProviderMetadata } from '../types';

interface ConnectorsViewProps {
  catalog: ProviderMetadata[];
  connections: ProviderConnection[];
  onCreateConnection: (payload: {
    provider_id: string;
    name: string;
    mode: 'mock' | 'live';
    credentials: Record<string, string>;
  }) => Promise<void>;
  onUpdateConnection: (
    id: string,
    payload: {
      name?: string;
      mode?: 'mock' | 'live';
      credentials?: Record<string, string>;
    }
  ) => Promise<void>;
  onDeleteConnection: (id: string) => Promise<void>;
  onSyncConnection: (id: string) => Promise<void>;
}

export const ConnectorsView: React.FC<ConnectorsViewProps> = ({
  catalog,
  connections,
  onCreateConnection,
  onUpdateConnection,
  onDeleteConnection,
  onSyncConnection,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const dialogTitleId = useId();

  const [editingConn, setEditingConn] = useState<ProviderConnection | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    catalog[0]?.provider_id || 'aws'
  );
  const [connName, setConnName] = useState<string>('');
  const [connMode, setConnMode] = useState<'mock' | 'live'>('mock');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const activeProviderMeta =
    catalog.find((p) => p.provider_id === selectedProviderId) || catalog[0];

  const openNewModal = (providerId: string) => {
    const meta = catalog.find((p) => p.provider_id === providerId);
    setEditingConn(null);
    setSelectedProviderId(providerId);
    setConnName(meta ? `${meta.display_name} Connection` : 'Cloud Connection');
    setConnMode('mock');
    setCredentials({});
    dialogRef.current?.showModal();
  };

  const openEditModal = (conn: ProviderConnection) => {
    setEditingConn(conn);
    setSelectedProviderId(conn.provider_id);
    setConnName(conn.name);
    setConnMode(conn.mode);
    setCredentials({});
    dialogRef.current?.showModal();
  };

  const handleCloseDialog = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = '';
      dialogRef.current.close();
    }
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingConn) {
        await onUpdateConnection(editingConn.id, {
          name: connName,
          mode: connMode,
          ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
        });
      } else {
        await onCreateConnection({
          provider_id: selectedProviderId,
          name: connName,
          mode: connMode,
          credentials,
        });
      }
      handleCloseDialog();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncSingle = async (id: string) => {
    setSyncingId(id);
    try {
      await onSyncConnection(id);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Modular Plugin Architecture Banner */}
      <section className="panel-card" aria-label="Modular Product Registry">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Modular Product Connectors & Plugin Registry</h2>
            <p className="panel-subtitle">
              Each product module implements <code>BaseCloudProvider</code> and registers its schema in{' '}
              <code>ProviderRegistry</code>. Supports both Live API credentials and Instant Demo/Mock Telemetry.
            </p>
          </div>
        </div>

        <div className="kpi-grid">
          {catalog.map((meta) => {
            const count = connections.filter((c) => c.provider_id === meta.provider_id).length;
            return (
              <article key={meta.provider_id} className="kpi-card">
                <div className="kpi-label">
                  <span className={`badge badge-${meta.provider_id}`}>
                    {meta.provider_id.toUpperCase()}
                  </span>
                  <span>{meta.category}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBlockStart: '0.25rem' }}>
                  {meta.display_name}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {meta.description}
                </p>
                <div
                  style={{
                    marginBlockStart: 'auto',
                    paddingBlockStart: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    <strong>{count}</strong> active connection{count === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    style={{ paddingBlock: '0.35rem', paddingInline: '0.7rem', fontSize: '0.78rem' }}
                    onClick={() => openNewModal(meta.provider_id)}
                  >
                    <Plus size={14} />
                    Add Connection
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Active Connections Table */}
      <section className="panel-card" aria-label="Configured Connections">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Configured Product Connections ({connections.length})</h2>
            <p className="panel-subtitle">
              Manage API credentials, switch between Mock/Demo and Live API modes, or trigger on-demand sync
            </p>
          </div>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="connections-table-caption"
          className="table-wrapper"
        >
          <table>
            <caption id="connections-table-caption">
              Persistent SQLite provider connections and synchronization status
            </caption>
            <thead>
              <tr>
                <th>Connection Name</th>
                <th>Product Plugin</th>
                <th>Collection Mode</th>
                <th>Status</th>
                <th>Last Synced (UTC)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((conn) => (
                <tr key={conn.id}>
                  <th>
                    <div style={{ fontWeight: 600 }}>{conn.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                      ID: <code>{conn.id}</code>
                    </div>
                  </th>
                  <td>
                    <span className={`badge badge-${conn.provider_id}`}>
                      {conn.provider_id.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor:
                          conn.mode === 'live'
                            ? 'rgba(16, 185, 129, 0.16)'
                            : 'rgba(56, 189, 248, 0.16)',
                        color:
                          conn.mode === 'live' ? 'var(--emerald-color)' : 'var(--brand-accent)',
                      }}
                    >
                      <Server size={12} />
                      {conn.mode === 'live' ? 'Live API Mode' : 'Realistic Demo / Mock'}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        color: 'var(--emerald-color)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                      }}
                    >
                      <CheckCircle2 size={14} />
                      {conn.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {conn.last_synced_at
                      ? conn.last_synced_at.replace('T', ' ').replace('Z', '')
                      : 'Never'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ paddingBlock: '0.3rem', paddingInline: '0.6rem', fontSize: '0.76rem' }}
                        onClick={() => handleSyncSingle(conn.id)}
                        disabled={syncingId === conn.id}
                      >
                        <RefreshCw size={13} />
                        {syncingId === conn.id ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ paddingBlock: '0.3rem', paddingInline: '0.6rem', fontSize: '0.76rem' }}
                        onClick={() => openEditModal(conn)}
                      >
                        <KeyRound size={13} />
                        Configure
                      </button>
                      {connections.length > 1 && (
                        <button
                          type="button"
                          className="btn"
                          style={{ paddingBlock: '0.3rem', paddingInline: '0.5rem', fontSize: '0.76rem' }}
                          onClick={() => onDeleteConnection(conn.id)}
                          aria-label={`Delete connection ${conn.name}`}
                        >
                          <Trash2 size={13} color="var(--danger-color)" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Native <dialog> Modal for Adding/Configuring Provider Connection (dialog guide compliant) */}
      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      >
        <h2
          id={dialogTitleId}
          style={{ marginBlockStart: 0, marginBlockEnd: '0.4rem', fontSize: '1.2rem' }}
        >
          {editingConn
            ? `Configure ${editingConn.name}`
            : `Add ${activeProviderMeta?.display_name || 'Cloud'} Connection`}
        </h2>
        <p style={{ marginBlockStart: 0, marginBlockEnd: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Credentials are stored locally in SQLite. Choose <strong>Demo / Mock Mode</strong> for immediate multi-cloud simulation or <strong>Live API Mode</strong> to query real provider endpoints.
        </p>

        <form className="form-stack" onSubmit={handleSaveConnection} method="POST">
          <div className="form-field">
            <label htmlFor="conn-name-input">Connection Display Name</label>
            <input
              id="conn-name-input"
              name="name"
              type="text"
              required
              autoFocus
              value={connName}
              onChange={(e) => setConnName(e.target.value)}
            />
          </div>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }} className="form-field">
            <legend style={{ fontSize: '0.875rem', fontWeight: 600, marginBlockEnd: '0.35rem' }}>
              Telemetry Collection Mode
            </legend>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="mode"
                  value="mock"
                  checked={connMode === 'mock'}
                  onChange={() => setConnMode('mock')}
                />
                <span>Demo / Mock Telemetry (Recommended for testing)</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="mode"
                  value="live"
                  checked={connMode === 'live'}
                  onChange={() => setConnMode('live')}
                />
                <span>Live API Credentials</span>
              </label>
            </div>
          </fieldset>

          {activeProviderMeta?.credential_fields.map((field) => (
            <div key={field.key} className="form-field">
              <label htmlFor={`cred-${field.key}`}>
                {field.label} {connMode === 'live' && field.required ? '*' : '(Optional in Demo Mode)'}
              </label>
              <input
                id={`cred-${field.key}`}
                name={field.key}
                type={field.field_type === 'password' ? 'password' : 'text'}
                placeholder={field.placeholder}
                required={connMode === 'live' && field.required}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={credentials[field.key] || ''}
                onChange={(e) =>
                  setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
              {field.help_text && <span className="form-hint">{field.help_text}</span>}
            </div>
          ))}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.65rem',
              marginBlockStart: '0.5rem',
            }}
          >
            <button type="button" className="btn" onClick={handleCloseDialog}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving & Syncing...' : 'Save & Sync Connection'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};
