import { useState, FormEvent } from 'react';
import { X, Check, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { apiFetch } from '../api/client';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  forced?: boolean;
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
  onSuccess,
  forced = false,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isValid = hasMinLength && hasUpper && hasLower && hasNumber;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValid) {
      setError('New password must fulfill all password policy requirements');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay-backdrop">
      <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="change-pwd-title">
        <div className="modal-header">
          <h2 id="change-pwd-title" style={{ fontSize: 16, fontWeight: 600 }}>
            {forced ? 'Mandatory Password Change' : 'Change Password'}
          </h2>
          {!forced && (
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Close dialog"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {forced && (
              <p style={{ fontSize: 13, color: 'var(--color-warning)', margin: 0 }}>
                You logged in with a temporary password. You must set a permanent secure password before accessing the workspace.
              </p>
            )}

            {error && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-danger-soft)',
                  border: '1px solid var(--color-danger)',
                  borderRadius: 'var(--radius-control)',
                  fontSize: 12.5,
                  color: 'var(--color-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={15} strokeWidth={1.75} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="currentPassword">
                Current Password
              </label>
              <input
                id="currentPassword"
                type={showPassword ? 'text' : 'password'}
                required
                className="form-control"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="newPassword">
                  New Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {showPassword ? <EyeOff size={13} strokeWidth={1.75} /> : <Eye size={13} strokeWidth={1.75} />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                required
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div
              style={{
                padding: '8px 10px',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-control)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 11.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasMinLength ? 'var(--color-success)' : 'var(--color-text-faint)' }}>
                {hasMinLength ? <Check size={12} strokeWidth={2} /> : <span>-</span>}
                <span>8+ characters</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasUpper ? 'var(--color-success)' : 'var(--color-text-faint)' }}>
                {hasUpper ? <Check size={12} strokeWidth={2} /> : <span>-</span>}
                <span>Uppercase letter</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasLower ? 'var(--color-success)' : 'var(--color-text-faint)' }}>
                {hasLower ? <Check size={12} strokeWidth={2} /> : <span>-</span>}
                <span>Lowercase letter</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasNumber ? 'var(--color-success)' : 'var(--color-text-faint)' }}>
                {hasNumber ? <Check size={12} strokeWidth={2} /> : <span>-</span>}
                <span>Number</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmNewPassword">
                Confirm New Password
              </label>
              <input
                id="confirmNewPassword"
                type={showPassword ? 'text' : 'password'}
                required
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            {!forced && (
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
            )}
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
