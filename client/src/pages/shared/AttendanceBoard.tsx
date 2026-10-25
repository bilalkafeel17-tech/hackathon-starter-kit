import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  X,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AttendanceRecord, CorrectionRequest, Department } from '../../types';

interface AttendanceBoardProps {
  isAdmin?: boolean;
}

export default function AttendanceBoard({ isAdmin = false }: AttendanceBoardProps) {
  const [activeTab, setActiveTab] = useState<'board' | 'corrections'>('board');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Data
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<any>({ present: 0, late: 0, half_day: 0, absent: 0, on_leave: 0 });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Corrections state
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [selectedCorrection, setSelectedCorrection] = useState<CorrectionRequest | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (activeTab === 'board') {
      fetchBoard();
    } else {
      fetchCorrections();
    }
  }, [selectedDate, activeTab, statusFilter, deptFilter]);

  async function loadDepartments() {
    try {
      const res = await apiFetch<Department[]>('/departments');
      if (res.data) setDepartments(res.data);
    } catch {
      // Ignore
    }
  }

  async function fetchBoard() {
    setLoading(true);
    try {
      let query = `/attendance/board?date=${selectedDate}`;
      if (statusFilter) query += `&status=${statusFilter}`;
      if (deptFilter) query += `&departmentId=${deptFilter}`;

      const res = await apiFetch<any>(query);
      if (res.data) {
        setRecords(res.data.records || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchCorrections() {
    setLoading(true);
    try {
      const res = await apiFetch<CorrectionRequest[]>('/attendance/corrections?status=pending');
      if (res.data) {
        setCorrections(res.data);
      }
    } finally {
      setLoading(false);
    }
  }

  function changeDate(days: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  }

  async function handleDecideCorrection(approve: boolean) {
    if (!selectedCorrection) return;
    try {
      const endpoint = `/attendance/corrections/${selectedCorrection._id}/${approve ? 'approve' : 'reject'}`;
      await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ comment: reviewComment.trim() || undefined }),
      });
      setSelectedCorrection(null);
      setReviewComment('');
      fetchCorrections();
    } catch (err: any) {
      alert(err.message || 'Failed to process correction');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Tracking</h1>
          <p className="page-description">Daily employee clock logs, status calculations, and manual correction triage.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-row">
        <button
          type="button"
          onClick={() => setActiveTab('board')}
          className={`tab-btn ${activeTab === 'board' ? 'active' : ''}`}
        >
          Daily Attendance Board
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('corrections')}
          className={`tab-btn ${activeTab === 'corrections' ? 'active' : ''}`}
        >
          Corrections Inbox {corrections.length > 0 && `(${corrections.length})`}
        </button>
      </div>

      {activeTab === 'board' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Date Navigator & Filters Toolbar */}
          <div
            className="card"
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {/* Date Nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => changeDate(-1)}
                className="btn btn-secondary btn-icon"
                title="Previous day"
              >
                <ChevronLeft size={16} strokeWidth={1.75} />
              </button>

              <input
                type="date"
                className="form-control mono-num"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: 150, height: 36, textAlign: 'center' }}
              />

              <button
                type="button"
                onClick={() => changeDate(1)}
                className="btn btn-secondary btn-icon"
                title="Next day"
              >
                <ChevronRight size={16} strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                className="btn btn-ghost btn-sm"
              >
                Today
              </button>
            </div>

            {/* Department Filter */}
            <select
              className="form-control"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ width: 200, height: 36 }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clickable Status Chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { key: '', label: 'All Personnel', count: records.length },
              { key: 'present', label: 'Present', count: summary.present || 0 },
              { key: 'late', label: 'Late', count: summary.late || 0 },
              { key: 'half_day', label: 'Half Day', count: summary.half_day || 0 },
              { key: 'on_leave', label: 'On Leave', count: summary.on_leave || 0 },
              { key: 'absent', label: 'Absent', count: summary.absent || 0 },
            ].map((chip) => {
              const isSelected = statusFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setStatusFilter(chip.key)}
                  style={{
                    backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: isSelected ? 'var(--color-primary-text)' : 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 999,
                    padding: '4px 12px',
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{chip.label}</span>
                  <span
                    className="mono-num"
                    style={{
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--color-surface-2)',
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 11,
                    }}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Total Hours</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                      No attendance activity recorded for {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => {
                    const empName =
                      typeof r.employeeId === 'object' && r.employeeId !== null
                        ? (r.employeeId as any).name
                        : 'Employee';
                    const empCode =
                      typeof r.employeeId === 'object' && r.employeeId !== null
                        ? (r.employeeId as any).employeeCode
                        : '';

                    return (
                      <tr key={r._id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{empName}</div>
                          <div className="mono-num" style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                            {empCode}
                          </div>
                        </td>
                        <td className="mono-num">
                          {r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="mono-num">
                          {r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="mono-num">
                          {r.workHours ? `${r.workHours.toFixed(1)} hrs` : '-'}
                        </td>
                        <td style={{ textTransform: 'capitalize', fontSize: 12.5 }}>
                          {r.source || 'web'}
                        </td>
                        <td>
                          <span className={`status-pill status-${r.status}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CORRECTIONS INBOX TAB */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Target Date</th>
                  <th>Requested Check In</th>
                  <th>Requested Check Out</th>
                  <th>Reason</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {corrections.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                      No pending correction requests awaiting review.
                    </td>
                  </tr>
                ) : (
                  corrections.map((corr) => {
                    const empName =
                      typeof corr.employeeId === 'object' && corr.employeeId !== null
                        ? (corr.employeeId as any).name
                        : 'Employee';
                    const empCode =
                      typeof corr.employeeId === 'object' && corr.employeeId !== null
                        ? (corr.employeeId as any).employeeCode
                        : '';

                    return (
                      <tr key={corr._id} onClick={() => setSelectedCorrection(corr)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{empName}</div>
                          <div className="mono-num" style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                            {empCode}
                          </div>
                        </td>
                        <td className="mono-num">{corr.dateKey}</td>
                        <td className="mono-num">{corr.requestedCheckIn || '-'}</td>
                        <td className="mono-num">{corr.requestedCheckOut || '-'}</td>
                        <td style={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {corr.reason}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCorrection(corr);
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Review Correction Drawer */}
          {selectedCorrection && (
            <>
              <div className="overlay-backdrop" onClick={() => setSelectedCorrection(null)} />
              <aside className="drawer" style={{ maxWidth: 440 }}>
                <header className="drawer-header">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Attendance Correction Review</div>
                    <div className="mono-num" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      Date: {selectedCorrection.dateKey}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCorrection(null)}
                    className="btn-ghost"
                    style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </header>

                <div className="drawer-body">
                  <div
                    style={{
                      padding: 14,
                      backgroundColor: 'var(--color-surface-2)',
                      borderRadius: 'var(--radius-control)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Applicant: </span>
                      <strong>
                        {typeof selectedCorrection.employeeId === 'object'
                          ? (selectedCorrection.employeeId as any).name
                          : 'Employee'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Requested In: </span>
                      <strong className="mono-num">{selectedCorrection.requestedCheckIn || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Requested Out: </span>
                      <strong className="mono-num">{selectedCorrection.requestedCheckOut || 'N/A'}</strong>
                    </div>
                  </div>

                  <div>
                    <span className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                      Submitted Reason
                    </span>
                    <div
                      style={{
                        padding: 12,
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-control)',
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      {selectedCorrection.reason}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Review Comment (Optional)</label>
                    <textarea
                      className="form-control input-textarea"
                      rows={3}
                      placeholder="e.g. Verified with security logs..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                    <button
                      type="button"
                      onClick={() => handleDecideCorrection(false)}
                      className="btn btn-danger"
                      style={{ flex: 1 }}
                    >
                      <X size={16} strokeWidth={1.75} />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecideCorrection(true)}
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                    >
                      <Check size={16} strokeWidth={1.75} />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              </aside>
            </>
          )}
        </div>
      )}
    </div>
  );
}
