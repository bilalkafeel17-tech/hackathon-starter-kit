import { useState, FormEvent } from 'react';
import { Eye, EyeOff, Check, X, AlertCircle, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api/client';
import { AuthResponse } from '../types';

interface AuthPagesProps {
  mode: 'setup' | 'login';
  onAuthSuccess: (authData: AuthResponse) => void;
  serverError?: string;
  onRetryConnection?: () => void;
}

export default function AuthPages({
  mode,
  onAuthSuccess,
  serverError,
  onRetryConnection,
}: AuthPagesProps) {
  // Setup fields
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Password policy live checklist
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    if (mode === 'setup') {
      if (!isPasswordValid) {
        setFieldErrors({ password: 'Password does not meet required security criteria' });
        return;
      }
      if (password !== confirmPassword) {
        setFieldErrors({ confirmPassword: 'Passwords do not match' });
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'setup') {
        const res = await apiFetch<AuthResponse>('/setup', {
          method: 'POST',
          body: JSON.stringify({
            companyName: companyName.trim(),
            adminName: adminName.trim(),
            adminEmail: email.trim(),
            adminPassword: password,
          }),
        });
        if (res.data) {
          onAuthSuccess(res.data);
        }
      } else {
        const res = await apiFetch<AuthResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        });
        if (res.data) {
          onAuthSuccess(res.data);
        }
      }
    } catch (err: any) {
      if (err.message) {
        setGeneralError(err.message);
      } else {
        setGeneralError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-split-layout">
      {/* Left Navy Panel */}
      <div className="auth-panel-left">
        <div>
          <div className="wordmark">
            <div className="logo-mark" />
            <span>HCM Lite</span>
          </div>

          <div style={{ marginTop: 48, maxWidth: 380 }}>
            <h2 style={{ fontSize: 24, color: '#FFFFFF', marginBottom: 24 }}>
              Set up your organization in three steps
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
              {/* Connecting line */}
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  bottom: 14,
                  left: 13,
                  width: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  zIndex: 0,
                }}
              />

              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: mode === 'setup' ? 'var(--color-accent)' : 'var(--color-sidebar-active)',
                    color: mode === 'setup' ? '#FFFFFF' : 'var(--color-sidebar-text)',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <div style={{ paddingTop: 4 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#FFFFFF' }}>
                    Create company and Admin account
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-sidebar-text)', marginTop: 2 }}>
                    Initialize enterprise identity and root credentials.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-sidebar-active)',
                    color: 'var(--color-sidebar-text)',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <div style={{ paddingTop: 4 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#FFFFFF' }}>
                    Define departments, leave types, and office rules
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-sidebar-text)', marginTop: 2 }}>
                    Configure organizational units and working calendar.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-sidebar-active)',
                    color: 'var(--color-sidebar-text)',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <div style={{ paddingTop: 4 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#FFFFFF' }}>
                    Invite HR to register employees
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-sidebar-text)', marginTop: 2 }}>
                    Onboard staff, track attendance, and process payroll.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-sidebar-text)', lineHeight: 1.5 }}>
          No sample data is loaded. Everything you see comes from your own records.
        </div>
      </div>

      {/* Right Surface Panel */}
      <div className="auth-panel-right">
        <div className="auth-form-card">
          {/* Public server unreachable banner */}
          {serverError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--color-danger-soft)',
                border: '1px solid var(--color-danger)',
                borderRadius: 'var(--radius-control)',
                fontSize: 13,
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Server unreachable, retry</span>
              {onRetryConnection && (
                <button
                  type="button"
                  onClick={onRetryConnection}
                  className="btn btn-secondary btn-sm"
                  style={{ height: 26, padding: '0 8px', fontSize: 12 }}
                >
                  <RefreshCw size={12} strokeWidth={1.75} style={{ marginRight: 4 }} />
                  Retry
                </button>
              )}
            </div>
          )}

          <div>
            <h1 className="page-title" style={{ fontSize: 24, marginBottom: 6 }}>
              {mode === 'setup' ? 'Setup Administrator' : 'Sign In'}
            </h1>
            <p className="page-description">
              {mode === 'setup'
                ? 'Create the primary enterprise administrator to initialize HCM Lite.'
                : 'Enter your credentials to access your organization workspace.'}
            </p>
          </div>

          {generalError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--color-danger-soft)',
                border: '1px solid var(--color-danger)',
                borderRadius: 'var(--radius-control)',
                fontSize: 13,
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'setup' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="companyName">
                    Company Name
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    required
                    className="form-control"
                    placeholder="Acme Corporation"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                  {fieldErrors.companyName && (
                    <span className="field-error">{fieldErrors.companyName}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="adminName">
                    Your Full Name
                  </label>
                  <input
                    id="adminName"
                    type="text"
                    required
                    className="form-control"
                    placeholder="Administrator"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                  {fieldErrors.adminName && (
                    <span className="field-error">{fieldErrors.adminName}</span>
                  )}
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="form-control"
                placeholder="admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="password">
                  Password
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
                  {showPassword ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {fieldErrors.password && (
                <span className="field-error">{fieldErrors.password}</span>
              )}
            </div>

            {/* Live password policy checklist for setup */}
            {mode === 'setup' && (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-control)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                  Password requirements:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasMinLength ? 'var(--color-success)' : 'var(--color-text-faint)' }}>
                  {hasMinLength ? <Check size={13} strokeWidth={2} /> : <X size={13} strokeWidth={2} />}
                  <span>8+ characters</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasUpper ? 'var(--color-success)' : 'var(--color-text-faint)' }}>
                  {hasUpper ? <Check size={13} strokeWidth={2} /> : <X size={13} strokeWidth={2} />}
                  <span>Uppercase letter</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasLower ? 'var(--color-success)' : 'var(--color-text-faint)' }}>
                  {hasLower ? <Check size={13} strokeWidth={2} /> : <X size={13} strokeWidth={2} />}
                  <span>Lowercase letter</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: hasNumber ? 'var(--color-success)' : 'var(--color-text-faint)' }}>
                  {hasNumber ? <Check size={13} strokeWidth={2} /> : <X size={13} strokeWidth={2} />}
                  <span>Number</span>
                </div>
              </div>
            )}

            {mode === 'setup' && (
              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {fieldErrors.confirmPassword && (
                  <span className="field-error">{fieldErrors.confirmPassword}</span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 8 }}
            >
              {loading
                ? 'Processing...'
                : mode === 'setup'
                ? 'Register organization'
                : 'Sign in to workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
