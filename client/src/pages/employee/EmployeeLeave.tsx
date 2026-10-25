import { useState, useEffect, FormEvent } from 'react';
import { apiFetch } from '../../api/client';
import {
  CalendarDays,
  Sparkles,
  Send,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { LeaveBalance, LeaveRequest, LeaveType } from '../../types';

export default function EmployeeLeave() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [history, setHistory] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart Leave AI parser box
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [parsingAi, setParsingAi] = useState(false);
  const [aiFilledNote, setAiFilledNote] = useState<string | null>(null);

  // Standard Form Fields
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [highlightFields, setHighlightFields] = useState(false);

  useEffect(() => {
    fetchLeaveData();
  }, []);

  async function fetchLeaveData() {
    setLoading(true);
    try {
      const [balRes, histRes, typesRes] = await Promise.all([
        apiFetch<LeaveBalance[]>('/leaves/balances'),
        apiFetch<any>('/leaves?limit=50'),
        apiFetch<LeaveType[]>('/leave-types'),
      ]);

      if (balRes.data) setBalances(balRes.data);
      if (histRes.data) setHistory(histRes.data.leaves || []);
      if (typesRes.data) {
        setLeaveTypes(typesRes.data.filter((t) => t.isActive));
        if (typesRes.data.length > 0 && !selectedTypeId) {
          setSelectedTypeId(typesRes.data[0]._id);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAiParse() {
    if (!naturalLanguageInput.trim()) return;
    setParsingAi(true);
    setAiFilledNote(null);
    setFormError(null);

    try {
      const res = await apiFetch<any>('/ai/smart-leave', {
        method: 'POST',
        body: JSON.stringify({ text: naturalLanguageInput.trim() }),
      });

      if (res.data) {
        if (res.data.leaveTypeId) setSelectedTypeId(res.data.leaveTypeId);
        if (res.data.startDate) setStartDate(res.data.startDate);
        if (res.data.endDate) setEndDate(res.data.endDate);
        if (res.data.reason) setReason(res.data.reason);

        setAiFilledNote(
          `Interpreted: ${res.data.leaveTypeName || 'Leave'} from ${res.data.startDate} to ${res.data.endDate} (${res.data.workingDays || 1} working days). Verify details below before submission.`
        );
        setHighlightFields(true);
        setTimeout(() => setHighlightFields(false), 3000);
      }
    } catch (err: any) {
      setAiFilledNote(err.message || 'Could not interpret statement. Please complete the form manually.');
    } finally {
      setParsingAi(false);
    }
  }

  async function handleApplyLeave(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!selectedTypeId || !startDate || !endDate || !reason.trim()) {
      setFormError('Please complete all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/leaves', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: selectedTypeId,
          startDate,
          endDate,
          reason: reason.trim(),
        }),
      });

      setReason('');
      setAiFilledNote(null);
      setNaturalLanguageInput('');
      fetchLeaveData();
      alert('Leave application submitted for supervisor approval.');
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit leave application');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelLeave(leaveId: string) {
    if (!confirm('Are you sure you want to cancel this pending leave request?')) return;
    try {
      await apiFetch(`/leaves/${leaveId}/cancel`, { method: 'PATCH' });
      fetchLeaveData();
    } catch (err: any) {
      alert(err.message || 'Could not cancel leave request');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Request Leave</h1>
          <p className="page-description">
            Apply for planned time off with quota balance tracking and smart natural language assistance.
          </p>
        </div>
      </div>

      {/* Top Row: Balance Cards per Type with Segmented Progress Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {balances.map((b, idx) => {
          const quota = b.quota || 0;
          const used = b.used || 0;
          const pending = b.pending || 0;
          const usedPct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
          const pendingPct = quota > 0 ? Math.min(100 - usedPct, Math.round((pending / quota) * 100)) : 0;

          return (
            <div key={idx} className="kpi-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-label">{b.leaveType.name}</span>
                <span className="mono-num" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Quota: {b.quota !== null ? `${b.quota}d` : 'Unlimited'}
                </span>
              </div>

              <div className="kpi-value" style={{ margin: '4px 0' }}>
                {b.remaining !== null ? `${b.remaining}d` : 'Unlimited'}
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>
                  remaining
                </span>
              </div>

              {/* Segmented bar: used (danger/neutral), pending (warning), remaining (success) */}
              {b.quota !== null ? (
                <div style={{ height: 6, backgroundColor: 'var(--color-surface-2)', borderRadius: 3, display: 'flex', overflow: 'hidden' }}>
                  <div style={{ width: `${usedPct}%`, backgroundColor: 'var(--color-text-faint)' }} title={`Used: ${used}d`} />
                  <div style={{ width: `${pendingPct}%`, backgroundColor: 'var(--color-warning)' }} title={`Pending: ${pending}d`} />
                </div>
              ) : (
                <div style={{ height: 6, backgroundColor: 'var(--color-surface-2)', borderRadius: 3 }} />
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-faint)', marginTop: 2 }}>
                <span>Used: {used}d</span>
                {pending > 0 && <span>Pending: {pending}d</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout: Smart Input & Pre-filled Application Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 20, alignItems: 'flex-start' }}>
        {/* Left: Smart Natural Language Parser */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} strokeWidth={1.75} color="var(--color-accent)" />
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Smart Leave Assistant</h2>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
            Describe your leave plans in your own words (English or Roman Urdu). The assistant will extract the leave category, start/end dates, and reason automatically.
          </p>

          <textarea
            className="form-control input-textarea"
            rows={5}
            placeholder="e.g. Need annual leave next Thursday and Friday for family wedding..."
            value={naturalLanguageInput}
            onChange={(e) => setNaturalLanguageInput(e.target.value)}
          />

          <button
            type="button"
            onClick={handleAiParse}
            disabled={parsingAi || !naturalLanguageInput.trim()}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            <Sparkles size={14} strokeWidth={1.75} color="var(--color-accent)" />
            <span>{parsingAi ? 'Analyzing statement...' : 'Fill form with AI'}</span>
          </button>

          {aiFilledNote && (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderLeft: '3px solid var(--color-accent)',
                borderRadius: 'var(--radius-control)',
                fontSize: 12,
                color: 'var(--color-text)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 10.5, color: 'var(--color-accent)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>
                AI-generated Extraction
              </div>
              {aiFilledNote}
            </div>
          )}
        </div>

        {/* Right: Leave Application Form */}
        <div
          className="card"
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            transition: 'border-color var(--transition-fast)',
            borderColor: highlightFields ? 'var(--color-accent)' : 'var(--color-border)',
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Application Details</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
              Verify working days and submit for supervisor approval.
            </p>
          </div>

          {formError && (
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
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Leave Category *</label>
              <select
                required
                className="form-control"
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
              >
                {leaveTypes.map((lt) => (
                  <option key={lt._id} value={lt._id}>
                    {lt.name} ({lt.isPaid ? 'Paid' : 'Unpaid'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input
                  type="date"
                  required
                  className="form-control mono-num"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input
                  type="date"
                  required
                  className="form-control mono-num"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reason for Absence *</label>
              <textarea
                required
                className="form-control input-textarea"
                rows={3}
                placeholder="State the official justification for your leave..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 8 }}
            >
              <Send size={15} strokeWidth={1.75} />
              <span>{submitting ? 'Submitting...' : 'Submit leave application'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* History Table */}
      <div className="card" style={{ padding: 20 }}>
        <span className="section-label" style={{ display: 'block', marginBottom: 12 }}>
          Application History
        </span>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Dates</th>
                <th className="mono-col">Working Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Decision Note</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>
                    No prior leave applications submitted.
                  </td>
                </tr>
              ) : (
                history.map((l) => (
                  <tr key={l._id}>
                    <td style={{ fontWeight: 600 }}>
                      {typeof l.leaveTypeId === 'object' && l.leaveTypeId !== null ? l.leaveTypeId.name : 'Leave'}
                    </td>
                    <td className="mono-num">
                      {l.startDate} to {l.endDate}
                    </td>
                    <td className="mono-col">{l.workingDays}d</td>
                    <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {l.reason}
                    </td>
                    <td>
                      <span className={`status-pill status-${l.status}`}>
                        {l.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {l.decisionComment || '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {l.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleCancelLeave(l._id)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-danger)', fontSize: 12 }}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
