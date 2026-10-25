import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import {
  CalendarDays,
  Check,
  X,
  AlertCircle,
  Users,
  Clock,
} from 'lucide-react';
import { LeaveRequest } from '../../types';

interface LeaveInboxProps {
  isAdmin?: boolean;
}

export default function LeaveInbox({ isAdmin = false }: LeaveInboxProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Review drawer
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [drawerDetails, setDrawerDetails] = useState<any>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchLeaves();
  }, [activeTab]);

  async function fetchLeaves() {
    setLoading(true);
    try {
      let query = '/leaves?limit=100';
      if (activeTab !== 'all') {
        query += `&status=${activeTab}`;
      }
      const res = await apiFetch<any>(query);
      if (res.data) {
        setLeaves(res.data.leaves || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function openReviewDrawer(leave: LeaveRequest) {
    setSelectedLeave(leave);
    setDrawerDetails(null);
    setReviewComment('');

    const empId = typeof leave.employeeId === 'object' ? (leave.employeeId as any)._id : leave.employeeId;
    try {
      const res = await apiFetch<any>(`/leaves/balances?employeeId=${empId}`);
      if (res.data) {
        setDrawerDetails({ balances: res.data });
      }
    } catch {
      // Ignore
    }
  }

  async function handleDecide(approve: boolean) {
    if (!selectedLeave) return;
    setActionLoading(true);
    try {
      const endpoint = `/leaves/${selectedLeave._id}/${approve ? 'approve' : 'reject'}`;
      await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ comment: reviewComment.trim() || undefined }),
      });
      setSelectedLeave(null);
      fetchLeaves();
    } catch (err: any) {
      alert(err.message || 'Failed to process leave application');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAdmin ? 'Leave Registry' : 'Leave Inbox'}</h1>
          <p className="page-description">
            Process absence requests, verify working days, balance quotas, and team coverage.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-row">
        {[
          { key: 'pending', label: 'Pending Review' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'all', label: 'All Applications' },
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

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Category</th>
              <th>Dates</th>
              <th className="mono-col">Working Days</th>
              <th>Reason</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                  No leave requests found in '{activeTab}'.
                </td>
              </tr>
            ) : (
              leaves.map((l) => {
                const empName = typeof l.employeeId === 'object' && l.employeeId !== null ? l.employeeId.name : 'Staff';
                const empCode = typeof l.employeeId === 'object' && l.employeeId !== null ? l.employeeId.employeeCode : '';
                const typeName = typeof l.leaveTypeId === 'object' && l.leaveTypeId !== null ? l.leaveTypeId.name : 'Leave';

                return (
                  <tr
                    key={l._id}
                    onClick={() => openReviewDrawer(l)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{empName}</div>
                      <div className="mono-num" style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                        {empCode}
                      </div>
                    </td>
                    <td>{typeName}</td>
                    <td className="mono-num">
                      {l.startDate} to {l.endDate}
                    </td>
                    <td className="mono-col" style={{ fontWeight: 600 }}>
                      {l.workingDays} days
                    </td>
                    <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {l.reason}
                    </td>
                    <td>
                      <span className={`status-pill status-${l.status}`}>
                        {l.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReviewDrawer(l);
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

      {/* Review Drawer */}
      {selectedLeave && (
        <>
          <div className="overlay-backdrop" onClick={() => setSelectedLeave(null)} />
          <aside className="drawer" style={{ maxWidth: 460 }}>
            <header className="drawer-header">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Leave Application Review</div>
                <div className="mono-num" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {selectedLeave.startDate} to {selectedLeave.endDate} ({selectedLeave.workingDays} working days)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeave(null)}
                className="btn-ghost"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </header>

            <div className="drawer-body">
              {/* Applicant summary */}
              <div
                style={{
                  padding: 12,
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-control)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Applicant: </span>
                  <strong>
                    {typeof selectedLeave.employeeId === 'object'
                      ? (selectedLeave.employeeId as any).name
                      : 'Staff'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Category: </span>
                  <strong>
                    {typeof selectedLeave.leaveTypeId === 'object'
                      ? (selectedLeave.leaveTypeId as any).name
                      : 'Leave'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Current Status: </span>
                  <span className={`status-pill status-${selectedLeave.status}`} style={{ textTransform: 'capitalize' }}>
                    {selectedLeave.status}
                  </span>
                </div>
              </div>

              {/* Applicant Leave Balances */}
              {drawerDetails?.balances && (
                <div>
                  <span className="section-label" style={{ display: 'block', marginBottom: 8 }}>
                    Current Balances for Applicant
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {drawerDetails.balances.map((b: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: 10,
                          backgroundColor: 'var(--color-surface-2)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-control)',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{b.leaveType?.name}</div>
                        <div className="mono-num" style={{ fontSize: 16, fontWeight: 700, margin: '2px 0' }}>
                          {b.remaining !== null ? `${b.remaining}d left` : 'Unlimited'}
                        </div>
                        <div style={{ color: 'var(--color-text-faint)', fontSize: 11 }}>
                          Quota: {b.quota ?? 'Unlimited'} • Used: {b.used}d
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Application reason */}
              <div>
                <span className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                  Reason Provided
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
                  {selectedLeave.reason}
                </div>
              </div>

              {selectedLeave.status === 'pending' && !isAdmin && (
                <>
                  <div className="form-group">
                    <label className="form-label">Decision Note (Optional)</label>
                    <textarea
                      className="form-control input-textarea"
                      rows={3}
                      placeholder="e.g. Approved. Ensure coverage with engineering lead..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleDecide(false)}
                      className="btn btn-danger"
                      style={{ flex: 1 }}
                    >
                      <X size={16} strokeWidth={1.75} />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleDecide(true)}
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                    >
                      <Check size={16} strokeWidth={1.75} />
                      <span>Approve</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
