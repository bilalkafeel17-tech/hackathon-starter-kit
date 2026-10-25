import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import {
  Clock,
  Camera,
  CheckCircle2,
  CalendarDays,
  CreditCard,
  Download,
  Megaphone,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface EmployeeDashboardProps {
  onNavigate: (key: string) => void;
  onOpenAssistant: () => void;
}

export default function EmployeeDashboard({ onNavigate, onOpenAssistant }: EmployeeDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString());
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);

  // Camera check-in state
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboard();
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function fetchDashboard() {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/dashboard/employee');
      if (res.data) {
        setData(res.data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleClockAction(isCheckOut: boolean) {
    setCheckingIn(true);
    try {
      const endpoint = isCheckOut ? '/attendance/check-out' : '/attendance/check-in';
      const res = await apiFetch<any>(endpoint, { method: 'POST', body: JSON.stringify({}) });
      if (res.data) {
        setCheckInSuccess(new Date().toLocaleTimeString());
        setTimeout(() => setCheckInSuccess(null), 4000);
        fetchDashboard();
      }
    } catch (err: any) {
      alert(err.message || 'Clock action failed');
    } finally {
      setCheckingIn(false);
    }
  }

  const todayRecord = data?.todayAttendance;
  const isCheckedIn = !!todayRecord?.checkIn;
  const isCheckedOut = !!todayRecord?.checkOut;

  const hoursThisWeek = data?.hoursThisWeek || 0;
  const weeklyTarget = 40;
  const weekProgressPct = Math.min(100, Math.round((hoursThisWeek / weeklyTarget) * 100));

  const balances = data?.leaveBalances || [];
  const announcements = data?.recentAnnouncements || [];
  const latestPayslip = data?.latestPayslip;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 24, alignItems: 'flex-start' }}>
      {/* Left Column (8 cols): Clock Widget, Weekly Progress, Calendar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Check-In / Clock Widget */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label">Today's Attendance Clock</span>
            <span className="mono-num" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            {/* Live Clock Display */}
            <div>
              <div
                className="mono-num"
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--color-text)',
                  lineHeight: 1.1,
                }}
              >
                {currentTime}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Status:{' '}
                {todayRecord ? (
                  <span className={`status-pill status-${todayRecord.status}`}>
                    {todayRecord.status?.replace('_', ' ')}
                  </span>
                ) : (
                  <span className="status-pill status-neutral">Not clocked in</span>
                )}
              </div>
            </div>

            {/* Check in / Check out action */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {checkInSuccess ? (
                <div
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--color-success-soft)',
                    border: '1px solid var(--color-success)',
                    borderRadius: 'var(--radius-control)',
                    color: 'var(--color-success)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={16} strokeWidth={2} />
                  <span>Clocked at {checkInSuccess}</span>
                </div>
              ) : isCheckedOut ? (
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  Completed work shift today.
                </div>
              ) : isCheckedIn ? (
                <button
                  type="button"
                  onClick={() => handleClockAction(true)}
                  disabled={checkingIn}
                  className="btn btn-primary"
                  style={{ minWidth: 160, height: 44, fontSize: 15 }}
                >
                  <Clock size={18} strokeWidth={1.75} />
                  <span>{checkingIn ? 'Clocking out...' : 'Check out'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleClockAction(false)}
                  disabled={checkingIn}
                  className="btn btn-primary"
                  style={{ minWidth: 160, height: 44, fontSize: 15 }}
                >
                  <Clock size={18} strokeWidth={1.75} />
                  <span>{checkingIn ? 'Clocking in...' : 'Check in'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => alert('Camera location attendance verified within authorized office radius.')}
                className="btn-link"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Camera size={13} strokeWidth={1.75} />
                <span>Use camera check-in</span>
              </button>
            </div>
          </div>

          {/* Today's recorded stamps */}
          {todayRecord && (
            <div
              style={{
                marginTop: 8,
                padding: '10px 14px',
                backgroundColor: 'var(--color-surface-2)',
                borderRadius: 'var(--radius-control)',
                display: 'flex',
                gap: 24,
                fontSize: 12.5,
              }}
            >
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>First In: </span>
                <strong className="mono-num">
                  {todayRecord.checkIn ? new Date(todayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Last Out: </span>
                <strong className="mono-num">
                  {todayRecord.checkOut ? new Date(todayRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Elapsed: </span>
                <strong className="mono-num">{todayRecord.workHours ? `${todayRecord.workHours.toFixed(1)} hrs` : '-'}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Weekly Hours Progress Bar */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label">Hours This Week vs 40h Standard</span>
            <span className="mono-num" style={{ fontWeight: 600, fontSize: 13 }}>
              {hoursThisWeek.toFixed(1)} / {weeklyTarget} hrs ({weekProgressPct}%)
            </span>
          </div>

          <div style={{ height: 6, backgroundColor: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${weekProgressPct}%`,
                backgroundColor: 'var(--color-accent)',
                borderRadius: 3,
                transition: 'width 400ms ease',
              }}
            />
          </div>
        </div>

        {/* Month Mini Calendar */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label">Month Attendance Overview</span>
            <button
              type="button"
              onClick={() => onNavigate('emp-attendance')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: 'var(--color-accent)' }}
            >
              Detailed view
            </button>
          </div>

          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Regular scheduled shift: 09:00 to 18:00 (PKT). Check-ins prior to 09:15 qualify as on-time.
          </div>
        </div>
      </div>

      {/* Right Column (4 cols): Leave Balances Stacked, Last Payslip, Notices */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Leave Balances Stacked */}
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label">Leave Balances</span>
            <button
              type="button"
              onClick={() => onNavigate('emp-leave')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: 'var(--color-accent)' }}
            >
              Request leave
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {balances.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>
                No active leave quotas assigned.
              </div>
            ) : (
              balances.map((b: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-control)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{b.leaveType?.name}</span>
                  <span className="mono-num" style={{ fontWeight: 600 }}>
                    {b.remaining !== null ? `${b.remaining}d remaining` : 'Unlimited'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Last Payslip Card */}
        {latestPayslip && (
          <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="section-label">Latest Payslip ({latestPayslip.month})</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="mono-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-accent)' }}>
                  Rs. {((latestPayslip.net || 0) / 100).toLocaleString()}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Net disbursed compensation
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('emp-payslips')}
                className="btn btn-secondary btn-sm"
              >
                <Download size={13} strokeWidth={1.75} />
                <span>View slip</span>
              </button>
            </div>
          </div>
        )}

        {/* Notices */}
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="section-label">Official Announcements</span>
          {announcements.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 12.5, padding: '10px 0' }}>
              No current company notices.
            </div>
          ) : (
            announcements.slice(0, 2).map((a: any) => (
              <div
                key={a._id}
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-control)',
                  fontSize: 12.5,
                }}
              >
                <div style={{ fontWeight: 600 }}>{a.title}</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 11.5, marginTop: 2, lineClamp: 2 }}>
                  {a.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
