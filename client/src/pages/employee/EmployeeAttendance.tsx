import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  X,
} from 'lucide-react';
import { AttendanceRecord } from '../../types';

export default function EmployeeAttendance() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(() => new Date().toISOString().slice(0, 10));

  // Correction Drawer
  const [correctionDrawerOpen, setCorrectionDrawerOpen] = useState(false);
  const [reqCheckIn, setReqCheckIn] = useState('09:00');
  const [reqCheckOut, setReqCheckOut] = useState('18:00');
  const [correctionReason, setCorrectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMonthRecords();
  }, [currentMonth]);

  async function fetchMonthRecords() {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/attendance/my?month=${currentMonth}`);
      if (res.data) {
        setRecords(res.data.records || []);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleMonthChange(offset: number) {
    const [y, m] = currentMonth.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1 + offset, 1));
    setCurrentMonth(date.toISOString().slice(0, 7));
  }

  async function handleSubmitCorrection() {
    if (!selectedDay || !correctionReason.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/attendance/corrections', {
        method: 'POST',
        body: JSON.stringify({
          dateKey: selectedDay,
          requestedCheckIn: reqCheckIn ? `${selectedDay}T${reqCheckIn}:00.000Z` : undefined,
          requestedCheckOut: reqCheckOut ? `${selectedDay}T${reqCheckOut}:00.000Z` : undefined,
          reason: correctionReason.trim(),
        }),
      });
      alert('Correction request submitted to HR for review.');
      setCorrectionDrawerOpen(false);
      setCorrectionReason('');
    } catch (err: any) {
      alert(err.message || 'Failed to submit correction');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRecord = records.find((r) => r.dateKey === selectedDay);

  // Generate days in month for calendar grid
  const [yearNum, monthNum] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayWeekday = new Date(yearNum, monthNum - 1, 1).getDay(); // 0 is Sun

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Attendance History</h1>
          <p className="page-description">Monthly calendar overview, daily timestamps, and time correction submission.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '8fr 4fr', gap: 20, alignItems: 'flex-start' }}>
        {/* Left: Month Navigator & Calendar Grid */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleMonthChange(-1)}
                className="btn btn-secondary btn-icon"
              >
                <ChevronLeft size={16} strokeWidth={1.75} />
              </button>
              <h2 className="mono-num" style={{ fontSize: 16, fontWeight: 600, minWidth: 120, textAlign: 'center' }}>
                {currentMonth}
              </h2>
              <button
                type="button"
                onClick={() => handleMonthChange(1)}
                className="btn btn-secondary btn-icon"
              >
                <ChevronRight size={16} strokeWidth={1.75} />
              </button>
            </div>

            {/* Status Legend */}
            <div style={{ display: 'flex', gap: 10, fontSize: 11.5, flexWrap: 'wrap' }}>
              <span className="status-pill status-present">Present</span>
              <span className="status-pill status-late">Late</span>
              <span className="status-pill status-half_day">Half Day</span>
              <span className="status-pill status-on_leave">On Leave</span>
              <span className="status-pill status-absent">Absent</span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-faint)', padding: '4px 0' }}>
                {day}
              </div>
            ))}

            {Array.from({ length: firstDayWeekday }).map((_, idx) => (
              <div key={`empty-${idx}`} style={{ height: 48 }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dateKey = `${currentMonth}-${String(day).padStart(2, '0')}`;
              const rec = records.find((r) => r.dateKey === dateKey);
              const isSelected = selectedDay === dateKey;

              let bg = 'var(--color-surface-2)';
              let color = 'var(--color-text)';
              if (rec) {
                if (rec.status === 'present') {
                  bg = 'var(--color-success-soft)';
                  color = 'var(--color-success)';
                } else if (rec.status === 'late') {
                  bg = 'var(--color-warning-soft)';
                  color = 'var(--color-warning)';
                } else if (rec.status === 'half_day') {
                  bg = 'var(--color-info-soft)';
                  color = 'var(--color-info)';
                } else if (rec.status === 'on_leave') {
                  bg = 'var(--color-accent-soft)';
                  color = 'var(--color-accent)';
                } else if (rec.status === 'absent') {
                  bg = 'var(--color-danger-soft)';
                  color = 'var(--color-danger)';
                }
              }

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(dateKey)}
                  style={{
                    height: 52,
                    backgroundColor: bg,
                    color: color,
                    border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-control)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  <span className="mono-num">{day}</span>
                  {rec && (
                    <span style={{ fontSize: 9.5, textTransform: 'capitalize' }}>
                      {rec.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Day Details & Request Correction */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="section-label">Selected Day Details</span>
            <span className="mono-num" style={{ fontWeight: 600 }}>{selectedDay}</span>
          </div>

          {selectedRecord ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Status</span>
                <span className={`status-pill status-${selectedRecord.status}`}>
                  {selectedRecord.status.replace('_', ' ')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Check In</span>
                <span className="mono-num">
                  {selectedRecord.checkIn ? new Date(selectedRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Check Out</span>
                <span className="mono-num">
                  {selectedRecord.checkOut ? new Date(selectedRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Elapsed Hours</span>
                <span className="mono-num">
                  {selectedRecord.workHours ? `${selectedRecord.workHours.toFixed(1)} hrs` : '-'}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '12px 0' }}>
              No check-in or leave recorded for {selectedDay}.
            </div>
          )}

          <button
            type="button"
            onClick={() => setCorrectionDrawerOpen(true)}
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 8 }}
          >
            <span>Request correction</span>
          </button>
        </div>
      </div>

      {/* Correction Request Drawer */}
      {correctionDrawerOpen && (
        <>
          <div className="overlay-backdrop" onClick={() => setCorrectionDrawerOpen(false)} />
          <aside className="drawer" style={{ maxWidth: 420 }}>
            <header className="drawer-header">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Attendance Correction</div>
                <div className="mono-num" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Target date: {selectedDay}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCorrectionDrawerOpen(false)}
                className="btn-ghost"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </header>

            <div className="drawer-body">
              <div className="form-group">
                <label className="form-label">Corrected Check In (HH:mm)</label>
                <input
                  type="time"
                  className="form-control mono-num"
                  value={reqCheckIn}
                  onChange={(e) => setReqCheckIn(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Corrected Check Out (HH:mm)</label>
                <input
                  type="time"
                  className="form-control mono-num"
                  value={reqCheckOut}
                  onChange={(e) => setReqCheckOut(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Discrepancy *</label>
                <textarea
                  required
                  className="form-control input-textarea"
                  rows={4}
                  placeholder="e.g. Card reader was offline at front gate upon morning arrival..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'auto' }}>
                <button
                  type="button"
                  onClick={() => setCorrectionDrawerOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitCorrection}
                  disabled={submitting || !correctionReason.trim()}
                  className="btn btn-primary"
                >
                  <Send size={15} strokeWidth={1.75} />
                  <span>{submitting ? 'Submitting...' : 'Submit correction'}</span>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
