import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { Shield, Filter, X, Clock, User, ArrowRight } from 'lucide-react';
import { AuditLogEntry } from '../../types';

export default function AdminAudit() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter]);

  async function fetchLogs() {
    setLoading(true);
    try {
      let query = '/audit?limit=50';
      if (actionFilter) query += `&action=${actionFilter}`;
      if (entityFilter) query += `&entity=${entityFilter}`;

      const res = await apiFetch<AuditLogEntry[]>(query);
      if (res.data) {
        setLogs(res.data);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Trail</h1>
          <p className="page-description">
            Append-only chronological record of all administrative, HR, and employee operational changes.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
          <Filter size={14} strokeWidth={1.75} />
          <span>Filters:</span>
        </div>

        <input
          type="text"
          className="form-control"
          placeholder="Filter by action (e.g. LOGIN, UPDATE)..."
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{ width: 220, height: 32, fontSize: 13 }}
        />

        <input
          type="text"
          className="form-control"
          placeholder="Filter by entity (e.g. Employee, Settings)..."
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          style={{ width: 220, height: 32, fontSize: 13 }}
        />

        {(actionFilter || entityFilter) && (
          <button
            type="button"
            onClick={() => {
              setActionFilter('');
              setEntityFilter('');
            }}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12 }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Role</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>
                  No audit trail records matched current filter criteria.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log._id}
                  onClick={() => setSelectedLog(log)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view diff"
                >
                  <td className="mono-num" style={{ fontSize: 12.5 }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 600 }}>{log.actorName}</td>
                  <td>
                    <span
                      className={`status-pill status-${log.actorRole === 'admin' ? 'warning' : log.actorRole === 'hr' ? 'info' : 'neutral'}`}
                    >
                      {log.actorRole}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{log.action}</td>
                  <td>{log.entity}</td>
                  <td className="mono-num" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {log.entityId ? log.entityId.slice(-8) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Diff Drawer */}
      {selectedLog && (
        <>
          <div className="overlay-backdrop" onClick={() => setSelectedLog(null)} />
          <aside className="drawer" style={{ maxWidth: 540 }}>
            <header className="drawer-header">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Audit Record Details</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{selectedLog.action} on {selectedLog.entity}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="btn-ghost"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </header>

            <div className="drawer-body">
              <div
                style={{
                  padding: 12,
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-control)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  fontSize: 12.5,
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Actor: </span>
                  <strong>{selectedLog.actorName}</strong> ({selectedLog.actorRole})
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Timestamp: </span>
                  <span className="mono-num">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <div className="section-label" style={{ marginBottom: 8 }}>
                  Change State Comparison
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Before */}
                  <div
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-control)',
                      backgroundColor: 'var(--color-surface-2)',
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-danger)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Before Change
                    </div>
                    <pre
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11.5,
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: 'var(--color-text)',
                      }}
                    >
                      {selectedLog.before ? JSON.stringify(selectedLog.before, null, 2) : 'None / Newly created'}
                    </pre>
                  </div>

                  {/* After */}
                  <div
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-control)',
                      backgroundColor: 'var(--color-surface-2)',
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)', textTransform: 'uppercase', marginBottom: 6 }}>
                      After Change
                    </div>
                    <pre
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11.5,
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: 'var(--color-text)',
                      }}
                    >
                      {selectedLog.after ? JSON.stringify(selectedLog.after, null, 2) : 'None'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
