import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import {
  CreditCard,
  Plus,
  Lock,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Download,
  CheckCircle2,
  X,
} from 'lucide-react';
import { PayrollRun } from '../../types';

interface PayrollRunsProps {
  isAdmin?: boolean;
}

export default function PayrollRuns({ isAdmin = false }: PayrollRunsProps) {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Month selector for new draft
  const [monthInput, setMonthInput] = useState(() => new Date().toISOString().slice(0, 7));
  const [creating, setCreating] = useState(false);

  // Finalize confirmation modal
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // Expanded calculation rows
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchRuns();
  }, []);

  async function fetchRuns() {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/payroll/runs');
      if (res.data) {
        setRuns(res.data.runs || []);
        if (res.data.runs?.length > 0 && !selectedRun) {
          fetchRunDetails(res.data.runs[0]._id);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchRunDetails(runId: string) {
    try {
      const res = await apiFetch<any>(`/payroll/runs/${runId}`);
      if (res.data) {
        setSelectedRun(res.data);
      }
    } catch {
      // Ignore
    }
  }

  async function handleCreateDraft() {
    setCreating(true);
    try {
      const res = await apiFetch<any>('/payroll/runs', {
        method: 'POST',
        body: JSON.stringify({ month: monthInput }),
      });
      if (res.data) {
        setSelectedRun(res.data);
        fetchRuns();
      }
    } catch (err: any) {
      alert(err.message || 'Could not create payroll run');
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmFinalize() {
    if (!selectedRun) return;
    setFinalizing(true);
    try {
      await apiFetch(`/payroll/runs/${selectedRun.run._id}/finalize`, {
        method: 'POST',
      });
      setFinalizeModalOpen(false);
      fetchRuns();
      fetchRunDetails(selectedRun.run._id);
    } catch (err: any) {
      alert(err.message || 'Failed to finalize payroll run');
    } finally {
      setFinalizing(false);
    }
  }

  async function handleDownloadPdf(payslipId: string) {
    try {
      const token = localStorage.getItem('hcm_token');
      const res = await fetch(`/api/payroll/payslips/${payslipId}/pdf`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('PDF download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${payslipId}.pdf`;
      a.click();
    } catch (err: any) {
      alert(err.message || 'Could not download payslip PDF');
    }
  }

  function toggleRow(itemId: string) {
    setExpandedRows((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  const run = selectedRun?.run;
  const items = selectedRun?.items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll Processing</h1>
          <p className="page-description">
            Monthly payroll cycle execution, automated tax computation, attendance deductions, and payslips.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="month"
            className="form-control mono-num"
            value={monthInput}
            onChange={(e) => setMonthInput(e.target.value)}
            style={{ width: 160, height: 38 }}
          />
          <button
            type="button"
            onClick={handleCreateDraft}
            disabled={creating}
            className="btn btn-primary"
          >
            <Plus size={16} strokeWidth={1.75} />
            <span>{creating ? 'Calculating...' : 'Create payroll draft'}</span>
          </button>
        </div>
      </div>

      {/* Stepper Header (Draft created -> HR reviewed -> Finalized) */}
      {run && (
        <div
          className="card"
          style={{
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={13} strokeWidth={2} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Draft Created</span>
            </div>

            <div style={{ width: 24, height: 1, backgroundColor: 'var(--color-border)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                2
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>HR Review</span>
            </div>

            <div style={{ width: 24, height: 1, backgroundColor: 'var(--color-border)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: run.status === 'finalized' ? 'var(--color-success)' : 'var(--color-surface-2)',
                  color: run.status === 'finalized' ? '#FFFFFF' : 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {run.status === 'finalized' ? <CheckCircle2 size={13} strokeWidth={2} /> : 3}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: run.status === 'finalized' ? 600 : 400,
                  color: run.status === 'finalized' ? 'var(--color-text)' : 'var(--color-text-muted)',
                }}
              >
                Finalized & Locked
              </span>
            </div>
          </div>

          <div>
            {run.status === 'draft' ? (
              isAdmin ? (
                <button
                  type="button"
                  onClick={() => setFinalizeModalOpen(true)}
                  className="btn btn-primary btn-sm"
                >
                  <Lock size={14} strokeWidth={1.75} />
                  <span>Finalize and lock run</span>
                </button>
              ) : (
                <span
                  style={{
                    fontSize: 12.5,
                    color: 'var(--color-warning)',
                    backgroundColor: 'var(--color-warning-soft)',
                    padding: '4px 10px',
                    borderRadius: 4,
                  }}
                >
                  Draft. Waiting for Admin to finalize.
                </span>
              )
            ) : (
              <span className="status-pill status-active">
                Locked on {run.finalizedAt?.slice(0, 10)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Totals Strip */}
      {run && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="kpi-card">
            <span className="kpi-label">Month Cycle</span>
            <span className="kpi-value">{run.month}</span>
            <span className="kpi-subtext">{run.employeeCount} active personnel</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Gross Salaries</span>
            <span className="kpi-value">
              Rs. {((run.totalGross || 0) / 100).toLocaleString()}
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Total Deductions</span>
            <span className="kpi-value" style={{ color: 'var(--color-danger)' }}>
              Rs. {((run.totalDeductions || 0) / 100).toLocaleString()}
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Income Tax (Withheld)</span>
            <span className="kpi-value">
              Rs. {((run.totalTax || 0) / 100).toLocaleString()}
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Net Disbursement</span>
            <span className="kpi-value" style={{ color: 'var(--color-accent)' }}>
              Rs. {((run.totalNet || 0) / 100).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Items Table with expandable calculation breakdown */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th className="mono-col">Gross</th>
              <th className="mono-col">Absent Deductions</th>
              <th className="mono-col">Tax</th>
              <th className="mono-col">Net Pay</th>
              <th style={{ textAlign: 'right' }}>Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                  No payroll items calculated yet. Click "Create payroll draft" to process.
                </td>
              </tr>
            ) : (
              items.map((item: any) => {
                const isExpanded = expandedRows[item._id];
                const emp = item.employeeId || {};

                return (
                  <>
                    <tr key={item._id} onClick={() => toggleRow(item._id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{emp.name || 'Staff'}</div>
                        <div className="mono-num" style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                          {emp.employeeCode || ''}
                        </div>
                      </td>
                      <td className="mono-col">
                        Rs. {((item.gross || 0) / 100).toLocaleString()}
                      </td>
                      <td className="mono-col" style={{ color: item.deductions?.unpaidLeave > 0 ? 'var(--color-danger)' : 'inherit' }}>
                        Rs. {(((item.deductions?.unpaidLeave || 0) + (item.deductions?.absent || 0)) / 100).toLocaleString()}
                      </td>
                      <td className="mono-col">
                        Rs. {((item.tax || 0) / 100).toLocaleString()}
                      </td>
                      <td className="mono-col" style={{ fontWeight: 700, color: 'var(--color-accent)' }}>
                        Rs. {((item.net || 0) / 100).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(item._id);
                          }}
                          className="btn btn-ghost btn-sm"
                        >
                          {isExpanded ? <ChevronUp size={14} strokeWidth={1.75} /> : <ChevronDown size={14} strokeWidth={1.75} />}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable row */}
                    {isExpanded && (
                      <tr key={`${item._id}-detail`} style={{ backgroundColor: 'var(--color-surface-2)' }}>
                        <td colSpan={6} style={{ padding: '16px 20px' }}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                              gap: 16,
                              fontSize: 12.5,
                            }}
                          >
                            <div>
                              <span className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                                Salary Components
                              </span>
                              <div>Basic: Rs. {((item.basic || 0) / 100).toLocaleString()}</div>
                              <div>HRA: Rs. {((item.hra || 0) / 100).toLocaleString()}</div>
                              <div>Medical: Rs. {((item.medical || 0) / 100).toLocaleString()}</div>
                            </div>

                            <div>
                              <span className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                                Attendance Impact
                              </span>
                              <div>Absent days: {item.attendanceMetrics?.absentDays || 0}</div>
                              <div>Half days: {item.attendanceMetrics?.halfDays || 0}</div>
                              <div>Unpaid leave: {item.attendanceMetrics?.unpaidLeaveDays || 0}</div>
                            </div>

                            <div>
                              <span className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                                Tax & Net
                              </span>
                              <div>Tax slab: {item.taxBreakdown?.slab || 'Standard'}</div>
                              <div>Annual taxable est: Rs. {(((item.taxBreakdown?.annualTaxableEst || 0)) / 100).toLocaleString()}</div>
                              <button
                                type="button"
                                onClick={() => handleDownloadPdf(item._id)}
                                className="btn btn-secondary btn-sm"
                                style={{ marginTop: 8 }}
                              >
                                <Download size={13} strokeWidth={1.75} />
                                <span>Download PDF</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Finalize Confirmation Modal */}
      {finalizeModalOpen && run && (
        <div className="overlay-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Confirm Payroll Finalization</h2>
              <button
                type="button"
                onClick={() => setFinalizeModalOpen(false)}
                className="btn-ghost"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-warning-soft)',
                  border: '1px solid var(--color-warning)',
                  borderRadius: 'var(--radius-control)',
                  fontSize: 12.5,
                  color: 'var(--color-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span>
                  Finalizing will permanently lock this payroll run. Individual payslips will be generated and published to all employees.
                </span>
              </div>

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
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Month:</span>
                  <strong>{run.month}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Total Personnel:</span>
                  <span className="mono-num">{run.employeeCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Gross Compensation:</span>
                  <span className="mono-num">Rs. {((run.totalGross || 0) / 100).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Total Deductions:</span>
                  <span className="mono-num">Rs. {((run.totalDeductions || 0) / 100).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Total Tax Withheld:</span>
                  <span className="mono-num">Rs. {((run.totalTax || 0) / 100).toLocaleString()}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: 8,
                    fontWeight: 700,
                  }}
                >
                  <span>Net Disbursement:</span>
                  <span className="mono-num" style={{ color: 'var(--color-accent)' }}>
                    Rs. {((run.totalNet || 0) / 100).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setFinalizeModalOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalize}
                disabled={finalizing}
                className="btn btn-primary"
              >
                <Lock size={15} strokeWidth={1.75} />
                <span>{finalizing ? 'Finalizing...' : 'Lock and publish payroll'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
