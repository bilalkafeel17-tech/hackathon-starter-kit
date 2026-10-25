import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import {
  Sparkles,
  Users,
  CheckCircle2,
  CalendarDays,
  Clock,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
} from 'lucide-react';

interface HrDashboardProps {
  onNavigate: (key: string) => void;
}

export default function HrDashboard({ onNavigate }: HrDashboardProps) {
  const [data, setData] = useState<any>({
    kpis: { headcount: 0, presentToday: 0, onLeaveToday: 0, lateToday: 0, pendingApprovals: 0 },
    pendingLeaves: [],
    lateComers: [],
    leaveByType: [],
    absenteeismByDept: [],
  });
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/dashboard/hr');
      if (res.data) {
        setData(res.data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSummarize() {
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
      setAiSummary('Could not generate AI briefing at this time.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleQuickLeaveAction(leaveId: string, approve: boolean) {
    try {
      await apiFetch(`/leaves/${leaveId}/${approve ? 'approve' : 'reject'}`, {
        method: 'PATCH',
        body: JSON.stringify({ comment: approve ? 'Quick approval from dashboard' : 'Rejected from dashboard' }),
      });
      fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  }

  const kpis = data.kpis || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header with AI Summarize */}
      <div className="page-header">
        <div>
          <h1 className="page-title">HR Operations Dashboard</h1>
          <p className="page-description">Today's staff presence, leave review pipeline, and attendance trends.</p>
        </div>
        <button
          type="button"
          onClick={handleSummarize}
          disabled={aiLoading}
          className="btn btn-secondary"
        >
          <Sparkles size={16} strokeWidth={1.75} color="var(--color-accent)" />
          <span>{aiLoading ? 'Summarizing...' : 'Summarize with AI'}</span>
        </button>
      </div>

      {/* AI Summary briefing */}
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
              Operational Briefing
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

      {/* Row 1: Five KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <div className="kpi-card">
          <span className="kpi-label">Active Headcount</span>
          <span className="kpi-value">{kpis.headcount ?? 0}</span>
          <span className="kpi-subtext">Verified personnel</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Present Today</span>
          <span className="kpi-value" style={{ color: 'var(--color-success)' }}>
            {kpis.presentToday ?? 0}
          </span>
          <span className="kpi-subtext">On-site and remote clocked in</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">On Leave</span>
          <span className="kpi-value" style={{ color: 'var(--color-accent)' }}>
            {kpis.onLeaveToday ?? 0}
          </span>
          <span className="kpi-subtext">Approved active leave</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Late Arrivals</span>
          <span className="kpi-value" style={{ color: 'var(--color-warning)' }}>
            {kpis.lateToday ?? 0}
          </span>
          <span className="kpi-subtext">Clocked after 09:15 grace limit</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Pending Approvals</span>
          <span className="kpi-value">
            {kpis.pendingApprovals ?? 0}
          </span>
          <span className="kpi-subtext">Awaiting HR action</span>
        </div>
      </div>

      {/* Row 2: Attendance Activity & Pending Approvals List */}
      <div style={{ display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 16 }}>
        {/* Attendance overview */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label">Attendance Distribution Today</span>
            <button
              type="button"
              onClick={() => onNavigate('hr-attendance')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: 'var(--color-accent)' }}
            >
              Open board
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '10px 0' }}>
            <div style={{ padding: 12, backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-control)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Present Rate</div>
              <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-success)', marginTop: 4 }}>
                {kpis.headcount > 0 ? `${Math.round(((kpis.presentToday || 0) / kpis.headcount) * 100)}%` : '0%'}
              </div>
            </div>
            <div style={{ padding: 12, backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-control)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>On Leave</div>
              <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-accent)', marginTop: 4 }}>
                {kpis.onLeaveToday || 0}
              </div>
            </div>
            <div style={{ padding: 12, backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-control)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Late</div>
              <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-warning)', marginTop: 4 }}>
                {kpis.lateToday || 0}
              </div>
            </div>
            <div style={{ padding: 12, backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-control)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Unaccounted</div>
              <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-danger)', marginTop: 4 }}>
                {Math.max(0, (kpis.headcount || 0) - (kpis.presentToday || 0) - (kpis.onLeaveToday || 0))}
              </div>
            </div>
          </div>
        </div>

        {/* Pending approvals list with quick Approve and Reject */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label">Pending Leave ({data.pendingLeaves?.length || 0})</span>
            <button
              type="button"
              onClick={() => onNavigate('hr-leave')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: 'var(--color-accent)' }}
            >
              All inbox
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 240 }}>
            {(!data.pendingLeaves || data.pendingLeaves.length === 0) ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                No pending leave requests.
              </div>
            ) : (
              data.pendingLeaves.slice(0, 4).map((l: any) => (
                <div
                  key={l._id}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-control)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {l.employeeId?.name || 'Staff'}
                    </span>
                    <span className="mono-num" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {l.workingDays}d ({l.leaveTypeId?.name})
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.reason}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => handleQuickLeaveAction(l._id, false)}
                      className="btn btn-danger btn-sm"
                      style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                    >
                      <X size={12} strokeWidth={2} />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickLeaveAction(l._id, true)}
                      className="btn btn-primary btn-sm"
                      style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                    >
                      <Check size={12} strokeWidth={2} />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Ranked Late-comers, Leave by Type */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top Late-comers ranked list */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="section-label">Frequent Late Arrivals (This Month)</span>
          {(!data.lateComers || data.lateComers.length === 0) ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No repeat late check-ins recorded this month.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.lateComers.slice(0, 5).map((lc: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-control)',
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="mono-num" style={{ fontWeight: 700, color: 'var(--color-text-faint)', width: 16 }}>
                      #{idx + 1}
                    </span>
                    <span style={{ fontWeight: 500 }}>{lc.employeeName || lc.name}</span>
                  </div>
                  <span className="mono-num" style={{ fontWeight: 600, color: 'var(--color-warning)' }}>
                    {lc.lateCount || lc.count} times
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leave by Category */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="section-label">Leave Breakdown by Category</span>
          {(!data.leaveByType || data.leaveByType.length === 0) ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No leave applications recorded in this period.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.leaveByType.map((item: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-control)',
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{item.leaveTypeName || item._id}</span>
                  <span className="mono-num" style={{ fontWeight: 600 }}>{item.count || item.totalDays} days</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
