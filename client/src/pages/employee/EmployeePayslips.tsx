import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { CreditCard, Download, FileText } from 'lucide-react';

export default function EmployeePayslips() {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayslips();
  }, []);

  async function fetchPayslips() {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/payroll/payslips');
      if (res.data) {
        setPayslips(res.data.payslips || res.data || []);
      }
    } finally {
      setLoading(false);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Payslips</h1>
          <p className="page-description">Monthly finalized compensation statements and official salary slips.</p>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Month Cycle</th>
              <th className="mono-col">Gross Pay</th>
              <th className="mono-col">Deductions</th>
              <th className="mono-col">Income Tax</th>
              <th className="mono-col">Net Disbursement</th>
              <th style={{ textAlign: 'right' }}>Document</th>
            </tr>
          </thead>
          <tbody>
            {payslips.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                  No published payslips recorded for your account.
                </td>
              </tr>
            ) : (
              payslips.map((p) => (
                <tr key={p._id}>
                  <td className="mono-num" style={{ fontWeight: 600 }}>
                    {p.month}
                  </td>
                  <td className="mono-col">Rs. {((p.gross || 0) / 100).toLocaleString()}</td>
                  <td className="mono-col" style={{ color: 'var(--color-danger)' }}>
                    Rs. {(((p.deductions?.unpaidLeave || 0) + (p.deductions?.absent || 0)) / 100).toLocaleString()}
                  </td>
                  <td className="mono-col">Rs. {((p.tax || 0) / 100).toLocaleString()}</td>
                  <td className="mono-col" style={{ fontWeight: 700, color: 'var(--color-accent)' }}>
                    Rs. {((p.net || 0) / 100).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(p._id)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Download size={13} strokeWidth={1.75} />
                      <span>Download PDF</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
