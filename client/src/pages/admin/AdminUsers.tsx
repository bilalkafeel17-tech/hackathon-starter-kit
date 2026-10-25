import { useState, useEffect, FormEvent } from 'react';
import { apiFetch } from '../../api/client';
import { UserPlus, Copy, Check, AlertCircle, X, RotateCcw, UserX } from 'lucide-react';
import { UserProfile } from '../../types';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form
  const [hrName, setHrName] = useState('');
  const [hrEmail, setHrEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await apiFetch<any[]>('/users');
      if (res.data) {
        setUsers(res.data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateHr(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await apiFetch<{ user: any; tempPassword: string }>('/users/hr', {
        method: 'POST',
        body: JSON.stringify({
          name: hrName.trim(),
          email: hrEmail.trim(),
        }),
      });

      if (res.data) {
        setTempPasswordModal({
          email: res.data.user.email,
          tempPassword: res.data.tempPassword,
        });
        setCreateModalOpen(false);
        setHrName('');
        setHrEmail('');
        fetchUsers();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create HR account');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(userId: string) {
    if (!confirm('Are you sure you want to generate a new temporary password for this user?')) return;
    try {
      const res = await apiFetch<{ tempPassword: string }>(`/users/${userId}/reset-password`, {
        method: 'POST',
      });
      if (res.data?.tempPassword) {
        const u = users.find((x) => x._id === userId);
        setTempPasswordModal({
          email: u?.email || 'User',
          tempPassword: res.data.tempPassword,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Could not reset password');
    }
  }

  async function handleDeactivate(userId: string) {
    if (!confirm('Are you sure you want to deactivate this login account?')) return;
    try {
      await apiFetch(`/users/${userId}/deactivate`, { method: 'PATCH' });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Could not deactivate account');
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Logins</h1>
          <p className="page-description">Manage access credentials, role authorizations, and password resets.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="btn btn-primary"
        >
          <UserPlus size={16} strokeWidth={1.75} />
          <span>Create HR login</span>
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>User Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Password State</th>
              <th>Last Login</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>
                  No system user records found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span
                      className={`status-pill status-${u.role === 'admin' ? 'warning' : u.role === 'hr' ? 'info' : 'active'}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${u.isActive ? 'status-active' : 'status-danger'}`}>
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td>
                    {u.mustChangePassword ? (
                      <span className="status-pill status-warning">Temp Password</span>
                    ) : (
                      <span className="status-pill status-active">Verified</span>
                    )}
                  </td>
                  <td className="mono-num" style={{ fontSize: 12 }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {u.role !== 'admin' && (
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(u._id)}
                          className="btn btn-secondary btn-sm"
                          title="Generate new temporary password"
                        >
                          <RotateCcw size={13} strokeWidth={1.75} />
                          <span>Reset</span>
                        </button>
                        {u.isActive && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(u._id)}
                            className="btn btn-danger btn-sm"
                            title="Deactivate account"
                          >
                            <UserX size={13} strokeWidth={1.75} />
                            <span>Deactivate</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create HR Login Modal */}
      {createModalOpen && (
        <div className="overlay-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Create HR Login</h2>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="btn-ghost"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <form onSubmit={handleCreateHr}>
              <div className="modal-body">
                {formError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-danger-soft)',
                      border: '1px solid var(--color-danger)',
                      borderRadius: 'var(--radius-control)',
                      fontSize: 12.5,
                      color: 'var(--color-danger)',
                    }}
                  >
                    {formError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Sarah Khan"
                    value={hrName}
                    onChange={(e) => setHrName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Work Email</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    placeholder="e.g. sarah.khan@company.com"
                    value={hrEmail}
                    onChange={(e) => setHrEmail(e.target.value)}
                  />
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                  A one-time temporary password will be generated. The HR user will be forced to change it on their first login.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Creating...' : 'Register HR user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Temporary Password Display Modal */}
      {tempPasswordModal && (
        <div className="overlay-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Temporary Credentials</h2>
              <button
                type="button"
                onClick={() => setTempPasswordModal(null)}
                className="btn-ghost"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-warning-soft)',
                  border: '1px solid var(--color-warning)',
                  borderRadius: 'var(--radius-control)',
                  fontSize: 12.5,
                  color: 'var(--color-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span>This temporary password will only be displayed once. Copy and deliver it securely to the user.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Account Email</label>
                <input
                  type="text"
                  readOnly
                  className="form-control mono-num"
                  value={tempPasswordModal.email}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Temporary Password</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    className="form-control mono-num"
                    value={tempPasswordModal.tempPassword}
                    style={{ fontWeight: 600, letterSpacing: '0.04em' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(tempPasswordModal.tempPassword)}
                    className="btn btn-secondary"
                  >
                    {copied ? <Check size={16} strokeWidth={1.75} color="var(--color-success)" /> : <Copy size={16} strokeWidth={1.75} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setTempPasswordModal(null)}
                className="btn btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
