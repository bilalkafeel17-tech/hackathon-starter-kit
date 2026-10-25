import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { Shield, Sparkles, AlertCircle, ArrowRight, CheckCircle2, Circle } from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (key: string) => void;
}

export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>({
    headcount: 0,
    attritionYtd: '0.0%',
    payrollCostMonth: 0,
    averageSalary: 0,
    deptHeadcount: [],
    genderSplit: [],
    deptPayroll: [],
    tenureBuckets: [],
    recentAudit: [],
  });
  const [readiness, setReadiness] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [dashRes, readyRes] = await Promise.all([
        apiFetch<any>('/dashboard/admin').catch(() => ({ data: null })),
        apiFetch<any>('/org/readiness').catch(() => ({ data: null })),
      ]);

      if (dashRes.data) {
        setMetrics(dashRes.data);
      }
      if (readyRes.data) {
        setReadiness(readyRes.data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateAiSummary() {
    setAiLoading(true);
    try {
      const res = await apiFetch<{ summary: string }>('/ai/dashboard-summary', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.data?.summary) {
        setAiSummary(res.data.summary);
      }
    } catch {
      setAiSummary('Unable to generate AI summary at this time.');
    } finally {
      setAiLoading(false);
    }
  }

  const checklistItems = readiness ? [
    { title: 'Company profile & timezone', done: readiness.hasCompanySettings, target: 'admin-settings' },
    { title: 'Active departments', done: readiness.hasDepartments, target: 'admin-settings' },
    { title: 'Designations mapped', done: readiness.hasDesignations, target: 'admin-settings' },
    { title: 'Leave types configured', done: readiness.hasLeaveTypes, target: 'admin-settings' },
    { title: 'Public holidays scheduled', done: readiness.hasHolidays, target: 'admin-settings' },
    { title: 'HR user created', done: readiness.hasHrUser, target: 'admin-users' },
  ] : [];

  const completedCount = checklistItems.filter((i) => i.done).length;
  const isSetupIncomplete = readiness && !readiness.isReadyForEmployees;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-description">High-level enterprise workforce, payroll, and organization health.</p>
        </div>
        <button
          type="button"
          onClick={handleGenerateAiSummary}
          disabled={aiLoading}
          className="btn btn-secondary"
        >
          <Sparkles size={16} strokeWidth={1.75} color="var(--color-accent)" />
          <span>{aiLoading ? 'Summarizing...' : 'Summarize with AI'}</span>
        </button>
      </div>

      {/* AI Summary card if triggered */}
      {aiSummary && (
        <div
          className="card"
          style={{
            borderLeft: '4px solid var(--color-accent)',
            backgroundColor: 'var(--color-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11.5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-accent)' }}>
              AI Organizational Briefing
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>
              AI-generated
            </span>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--color-text)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
            {aiSummary}
          </p>
        </div>
      )}

      {/* Row 1: Four KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="kpi-card">
          <span className="kpi-label">Active Headcount</span>
          <span className="kpi-value">{metrics.headcount ?? 0}</span>
          <span className="kpi-subtext">Total verified active personnel</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Attrition Rate (YTD)</span>
          <span className="kpi-value">{metrics.attritionYtd ?? '0.0%'}</span>
          <span className="kpi-subtext">Annualized voluntary and involuntary exits</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Payroll Cost (This Month)</span>
          <span className="kpi-value">
            Rs. {((metrics.payrollCostMonth ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </span>
          <span className="kpi-subtext">Disbursed and pending monthly compensation</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Average Base Salary</span>
          <span className="kpi-value">
            Rs. {((metrics.averageSalary ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </span>
          <span className="kpi-subtext">Per active employee benchmark</span>
        </div>
      </div>

      {/* Row 2: Incomplete Setup Checklist OR Department Headcount & Gender Split */}
      {isSetupIncomplete ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Organization Setup Checklist</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                Complete these initial requirements before HR can register employees.
              </p>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' }}>
              {completedCount} of {checklistItems.length} completed
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {checklistItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-control)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {item.done ? (
                    <CheckCircle2 size={18} strokeWidth={1.75} color="var(--color-success)" />
                  ) : (
                    <Circle size={18} strokeWidth={1.75} color="var(--color-text-muted)" />
                  )}
                  <span style={{ fontSize: 13.5, fontWeight: item.done ? 500 : 600, color: item.done ? 'var(--color-text)' : 'var(--color-text)' }}>
                    {item.title}
                  </span>
                </div>

                {!item.done && (
                  <button
                    type="button"
                    onClick={() => onNavigate(item.target)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 12, height: 28, padding: '0 8px' }}
                  >
                    <span>Configure</span>
                    <ArrowRight size={12} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 16 }}>
          {/* Headcount by department horizontal bars */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span className="section-label">Headcount by Department</span>
            {metrics.deptHeadcount && metrics.deptHeadcount.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {metrics.deptHeadcount.map((dept: any, idx: number) => {
                  const maxCount = Math.max(...metrics.deptHeadcount.map((d: any) => d.count || 1));
                  const pct = Math.round(((dept.count || 0) / maxCount) * 100);
                  const colors = ['var(--chart-navy)', 'var(--chart-steel)', 'var(--chart-brass)', 'var(--chart-sage)', 'var(--chart-clay)'];
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ fontWeight: 500 }}>{dept.departmentName || dept._id}</span>
                        <span className="mono-num">{dept.count}</span>
                      </div>
                      <div style={{ height: 8, backgroundColor: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: colors[idx % colors.length],
                            borderRadius: 2,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                No active departments recorded yet.
              </div>
            )}
          </div>

          {/* Employment Type Distribution */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span className="section-label">Workforce Composition</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Full-Time Staff</span>
                <span className="mono-num" style={{ fontWeight: 600 }}>{metrics.fullTimeCount ?? metrics.headcount ?? 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Part-Time Staff</span>
                <span className="mono-num" style={{ fontWeight: 600 }}>{metrics.partTimeCount ?? 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Contractors</span>
                <span className="mono-num" style={{ fontWeight: 600 }}>{metrics.contractCount ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Row 3: Audit Activity Feed & System Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 16 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="section-label">Recent Audit Trail</span>
            <button
              type="button"
              onClick={() => onNavigate('admin-audit')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: 'var(--color-accent)' }}
            >
              View all
            </button>
          </div>

          {metrics.recentAudit && metrics.recentAudit.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {metrics.recentAudit.slice(0, 5).map((log: any) => (
                <div
                  key={log._id}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-control)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={14} strokeWidth={1.75} color="var(--color-text-muted)" />
                    <span style={{ fontWeight: 500 }}>{log.action}</span>
                    <span style={{ color: 'var(--color-text-faint)' }}>by</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{log.actorName}</span>
                  </div>
                  <span className="mono-num" style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Audit events will appear here as administrative actions occur.
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="section-label">Administrative Scope</span>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            As an Administrator, you have complete visibility over company configuration, user permissions, global salary benchmarks, and the append-only audit trail.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => onNavigate('admin-settings')}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'flex-start' }}
            >
              Configure Office Hours & Rules
            </button>
            <button
              type="button"
              onClick={() => onNavigate('admin-users')}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'flex-start' }}
            >
              Manage HR and System Logins
            </button>
            <button
              type="button"
              onClick={() => onNavigate('admin-payroll')}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'flex-start' }}
            >
              Review and Finalize Payroll
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
