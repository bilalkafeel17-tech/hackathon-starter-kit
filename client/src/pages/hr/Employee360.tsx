import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  History,
  Activity,
  Layers,
  Building,
  Mail,
  Phone,
  Clock,
  LogOut,
  Edit2,
  DollarSign,
  AlertCircle,
  X,
} from 'lucide-react';
import { Employee } from '../../types';

interface Employee360Props {
  employeeId: string;
  onBack: () => void;
  isAdmin?: boolean;
}

export default function Employee360({ employeeId, onBack, isAdmin = false }: Employee360Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'leave' | 'payroll' | 'salary' | 'activity'>('overview');

  // Modals
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exitReason, setExitReason] = useState('');
  const [exitDate, setExitDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [newGross, setNewGross] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [salaryReason, setSalaryReason] = useState('');

  useEffect(() => {
    fetch360();
  }, [employeeId]);

  async function fetch360() {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/employees/${employeeId}/360`);
      if (res.data) {
        setData(res.data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordExit() {
    if (!exitReason.trim()) return;
    try {
      await apiFetch(`/employees/${employeeId}/exit`, {
        method: 'POST',
        body: JSON.stringify({
          exitDate,
          reason: exitReason.trim(),
        }),
      });
      setExitModalOpen(false);
      fetch360();
    } catch (err: any) {
      alert(err.message || 'Could not record employee exit');
    }
  }

  async function handleUpdateSalary() {
    const gross = Math.round(Number(newGross) * 100);
    if (!gross || gross <= 0) return;
    try {
      await apiFetch(`/employees/${employeeId}/salary`, {
        method: 'POST',
        body: JSON.stringify({
          gross,
          effectiveFrom,
          reason: salaryReason.trim() || undefined,
        }),
      });
      setSalaryModalOpen(false);
      fetch360();
    } catch (err: any) {
      alert(err.message || 'Could not record salary revision');
    }
  }

  if (loading || !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading Employee 360 profile...
      </div>
    );
  }

  const emp = data.employee;
  const deptName = emp?.departmentId?.name || 'Unassigned';
  const desigName = emp?.designationId?.name || 'Unassigned';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Back Nav */}
      <button
        type="button"
        onClick={onBack}
        className="btn btn-ghost btn-sm"
        style={{ width: 'fit-content' }}
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        <span>Back to Directory</span>
      </button>

      {/* 360 Header Card */}
      <div
        className="card"
        style={{
          padding: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-2)',
              color: 'var(--color-text)',
              fontSize: 20,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--color-border)',
            }}
          >
            {emp.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="page-title" style={{ fontSize: 22, margin: 0 }}>
                {emp.name}
              </h1>
              <span className="mono-num" style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {emp.employeeCode}
              </span>
              <span
                className={`status-pill ${emp.status === 'active' ? 'status-active' : 'status-danger'}`}
              >
                {emp.status}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {desigName} • {deptName} • Joined on {emp.joiningDate}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        {emp.status === 'active' && !isAdmin && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setSalaryModalOpen(true)}
              className="btn btn-secondary btn-sm"
            >
              <DollarSign size={14} strokeWidth={1.75} />
              <span>Change salary</span>
            </button>
            <button
              type="button"
              onClick={() => setExitModalOpen(true)}
              className="btn btn-danger btn-sm"
            >
              <LogOut size={14} strokeWidth={1.75} />
              <span>Record exit</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-row">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'attendance', label: 'Attendance' },
          { key: 'leave', label: 'Leave' },
          { key: 'payroll', label: 'Payroll' },
          { key: 'salary', label: 'Salary History' },
          { key: 'activity', label: 'Audit Activity' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key as any)}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="section-label">Contact & Demographic Information</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Email: </span>
                <strong>{emp.email}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Phone: </span>
                <span>{emp.phone || 'Not recorded'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Address: </span>
                <span>{emp.address || 'Not recorded'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Employment Type: </span>
                <span style={{ textTransform: 'capitalize' }}>{emp.employmentType?.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="section-label">Current Compensation Structure</span>
            {data.sections?.salary?.current ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Basic</span>
                  <span className="mono-num">Rs. {(data.sections.salary.current.basic / 100).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>HRA (40%)</span>
                  <span className="mono-num">Rs. {(data.sections.salary.current.hra / 100).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Medical (10%)</span>
                  <span className="mono-num">Rs. {(data.sections.salary.current.medical / 100).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 6, fontWeight: 600 }}>
                  <span>Gross Monthly Total</span>
                  <span className="mono-num" style={{ color: 'var(--color-accent)' }}>
                    Rs. {(data.sections.salary.current.gross / 100).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No salary version recorded.</div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Attendance */}
      {activeTab === 'attendance' && (
        <div className="card">
          <span className="section-label" style={{ marginBottom: 12, display: 'block' }}>
            Recent Attendance Log
          </span>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Work Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!data.sections?.attendance?.records || data.sections.attendance.records.length === 0) ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>
                    No attendance records logged for this employee.
                  </td>
                </tr>
              ) : (
                data.sections.attendance.records.map((r: any) => (
                  <tr key={r._id}>
                    <td className="mono-num">{r.dateKey}</td>
                    <td className="mono-num">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="mono-num">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="mono-num">{r.workHours ? `${r.workHours.toFixed(1)} hrs` : '-'}</td>
                    <td>
                      <span className={`status-pill status-${r.status}`}>
                        {r.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: Leave */}
      {activeTab === 'leave' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <span className="section-label" style={{ marginBottom: 12, display: 'block' }}>
              Leave Balances ({data.sections?.leave?.year || new Date().getFullYear()})
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {data.sections?.leave?.balances?.map((b: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    backgroundColor: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-control)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{b.leaveType?.name}</div>
                  <div className="mono-num" style={{ fontSize: 20, fontWeight: 700, margin: '4px 0' }}>
                    {b.remaining !== null ? `${b.remaining}d` : 'Unlimited'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Quota: {b.quota ?? 'Unlimited'} • Used: {b.used}d
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Salary History */}
      {activeTab === 'salary' && (
        <div className="card">
          <span className="section-label" style={{ marginBottom: 12, display: 'block' }}>
            Append-Only Salary Version History
          </span>
          <table className="data-table">
            <thead>
              <tr>
                <th>Effective From</th>
                <th className="mono-col">Gross</th>
                <th className="mono-col">Basic</th>
                <th className="mono-col">HRA (40%)</th>
                <th className="mono-col">Medical (10%)</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {(!data.sections?.salary?.history || data.sections.salary.history.length === 0) ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>
                    No salary revision history available.
                  </td>
                </tr>
              ) : (
                data.sections.salary.history.map((s: any) => (
                  <tr key={s._id}>
                    <td className="mono-num">{s.effectiveFrom}</td>
                    <td className="mono-col" style={{ fontWeight: 600 }}>Rs. {(s.gross / 100).toLocaleString()}</td>
                    <td className="mono-col">Rs. {(s.basic / 100).toLocaleString()}</td>
                    <td className="mono-col">Rs. {(s.hra / 100).toLocaleString()}</td>
                    <td className="mono-col">Rs. {(s.medical / 100).toLocaleString()}</td>
                    <td>{s.reason || 'Initial registration'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Exit Modal */}
      {exitModalOpen && (
        <div className="overlay-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Record Employee Exit</h2>
              <button
                type="button"
                onClick={() => setExitModalOpen(false)}
                className="btn-ghost"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--color-danger)', margin: 0 }}>
                Recording exit deactivates login tokens immediately and locks employee status to 'exited'.
              </p>
              <div className="form-group">
                <label className="form-label">Exit Date</label>
                <input
                  type="date"
                  className="form-control mono-num"
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Departure</label>
                <textarea
                  className="form-control input-textarea"
                  rows={3}
                  placeholder="e.g. Resigned to pursue other career opportunities..."
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setExitModalOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordExit}
                className="btn btn-danger"
              >
                Confirm Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Salary Modal */}
      {salaryModalOpen && (
        <div className="overlay-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Create Salary Revision</h2>
              <button
                type="button"
                onClick={() => setSalaryModalOpen(false)}
                className="btn-ghost"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">New Monthly Gross (PKR)</label>
                <input
                  type="number"
                  className="form-control mono-num"
                  placeholder="120000"
                  value={newGross}
                  onChange={(e) => setNewGross(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Effective From Date</label>
                <input
                  type="date"
                  className="form-control mono-num"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Revision Reason</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Annual merit appraisal"
                  value={salaryReason}
                  onChange={(e) => setSalaryReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setSalaryModalOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateSalary}
                className="btn btn-primary"
              >
                Apply revision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
