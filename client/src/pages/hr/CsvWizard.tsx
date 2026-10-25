import { useState, useRef } from 'react';
import { apiFetch } from '../../api/client';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Copy,
} from 'lucide-react';

interface CsvWizardProps {
  onSuccessReturn: () => void;
}

export default function CsvWizard({ onSuccessReturn }: CsvWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dry run result
  const [dryRunData, setDryRunData] = useState<any>(null);
  const [filterErrorsOnly, setFilterErrorsOnly] = useState(false);

  // Success credentials
  const [importedCredentials, setImportedCredentials] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleDownloadTemplate() {
    try {
      const token = localStorage.getItem('hcm_token');
      const res = await fetch('/api/employees/template', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employee_import_template.csv';
      a.click();
    } catch {
      alert('Could not download template');
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setCsvContent(evt.target?.result as string);
    };
    reader.readAsText(file);
  }

  async function handleDryRun() {
    if (!csvContent.trim()) {
      setErrorMessage('Please select a valid CSV file');
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch<any>('/employees/import', {
        method: 'POST',
        body: JSON.stringify({
          csvData: csvContent,
          dryRun: true,
        }),
      });

      if (res.data) {
        setDryRunData(res.data);
        setStep(2);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Validation failed for CSV data');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmImport() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch<any>('/employees/import', {
        method: 'POST',
        body: JSON.stringify({
          csvData: csvContent,
          dryRun: false,
        }),
      });

      if (res.data) {
        setImportedCredentials(res.data.credentials || []);
        setStep(3);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Import failed to execute');
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadCredentialsCsv() {
    if (!importedCredentials.length) return;
    const header = 'EmployeeCode,Name,Email,TemporaryPassword\n';
    const rows = importedCredentials
      .map((c) => `"${c.employeeCode}","${c.name}","${c.email}","${c.temporaryPassword}"`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `imported-credentials-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bulk CSV Import</h1>
          <p className="page-description">
            Three-step verified import with validation dry-run, error isolation, and credential issuance.
          </p>
        </div>
        <button
          type="button"
          onClick={onSuccessReturn}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>

      {/* Stepper Header */}
      <div
        className="card"
        style={{
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {[
          { num: 1, label: 'Upload CSV File' },
          { num: 2, label: 'Validation & Dry Run' },
          { num: 3, label: 'Confirm & Credentials' },
        ].map((s) => (
          <div
            key={s.num}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: step === s.num ? 'var(--color-text)' : 'var(--color-text-muted)',
              fontWeight: step === s.num ? 600 : 400,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor:
                  step > s.num
                    ? 'var(--color-success)'
                    : step === s.num
                    ? 'var(--color-primary)'
                    : 'var(--color-surface-2)',
                color: step >= s.num ? '#FFFFFF' : 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              {step > s.num ? <CheckCircle2 size={14} strokeWidth={2} /> : s.num}
            </div>
            <span style={{ fontSize: 13 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {errorMessage && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--color-danger-soft)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-control)',
            fontSize: 13,
            color: 'var(--color-danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} strokeWidth={1.75} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: Upload */}
      {step === 1 && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Select File to Import</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                Upload a standard CSV file with employee name, email, department code, designation, joining date, and salary.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="btn btn-secondary btn-sm"
            >
              <Download size={14} strokeWidth={1.75} />
              <span>Download sample template</span>
            </button>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--color-border)',
              borderRadius: 'var(--radius-card)',
              padding: 40,
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: 'var(--color-surface-2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              accept=".csv"
              style={{ display: 'none' }}
            />
            <FileSpreadsheet size={36} strokeWidth={1.75} color="var(--color-text-muted)" />
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {fileName ? fileName : 'Click to select CSV file'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>
              Supports UTF-8 CSV files up to 100 rows per batch.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              type="button"
              onClick={handleDryRun}
              disabled={loading || !csvContent}
              className="btn btn-primary"
            >
              <span>{loading ? 'Validating...' : 'Validate and Review'}</span>
              <ArrowRight size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Review Dry Run */}
      {step === 2 && dryRunData && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Validation Dry Run Summary</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
              Verify parsed row counts and review format errors before writing records to the database.
            </p>
          </div>

          {/* Counts Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div className="kpi-card" style={{ padding: 12 }}>
              <span className="kpi-label">Total Rows</span>
              <span className="kpi-value" style={{ fontSize: 20 }}>{dryRunData.totalRows || 0}</span>
            </div>
            <div className="kpi-card" style={{ padding: 12 }}>
              <span className="kpi-label">Valid Records</span>
              <span className="kpi-value" style={{ fontSize: 20, color: 'var(--color-success)' }}>
                {dryRunData.validRows || 0}
              </span>
            </div>
            <div className="kpi-card" style={{ padding: 12 }}>
              <span className="kpi-label">Error Rows</span>
              <span className="kpi-value" style={{ fontSize: 20, color: 'var(--color-danger)' }}>
                {dryRunData.errorCount || (dryRunData.errors ? dryRunData.errors.length : 0)}
              </span>
            </div>
          </div>

          {/* Errors table if any */}
          {dryRunData.errors && dryRunData.errors.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="section-label" style={{ color: 'var(--color-danger)' }}>
                  Errors Detected ({dryRunData.errors.length})
                </span>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Row Number</th>
                      <th>Field</th>
                      <th>Validation Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dryRunData.errors.map((err: any, idx: number) => (
                      <tr key={idx}>
                        <td className="mono-num" style={{ fontWeight: 600 }}>Line {err.row}</td>
                        <td style={{ fontWeight: 500 }}>{err.field}</td>
                        <td style={{ color: 'var(--color-danger)' }}>{err.message || err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn btn-secondary"
            >
              <ArrowLeft size={16} strokeWidth={1.75} />
              <span>Back to Upload</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={loading || (dryRunData.errors && dryRunData.errors.length > 0)}
              className="btn btn-primary"
            >
              <span>{loading ? 'Importing...' : 'Confirm and Import'}</span>
              <ArrowRight size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Confirm & Credentials */}
      {step === 3 && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Import Complete</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                {importedCredentials.length} employees have been registered. Download generated temporary credentials.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadCredentialsCsv}
              className="btn btn-secondary"
            >
              <Download size={15} strokeWidth={1.75} />
              <span>Download Credentials CSV</span>
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee Code</th>
                  <th>Name</th>
                  <th>Login Email</th>
                  <th>Temporary Password</th>
                </tr>
              </thead>
              <tbody>
                {importedCredentials.map((c, idx) => (
                  <tr key={idx}>
                    <td className="mono-num" style={{ fontWeight: 600 }}>{c.employeeCode}</td>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td>{c.email}</td>
                    <td className="mono-num" style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
                      {c.temporaryPassword}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              type="button"
              onClick={onSuccessReturn}
              className="btn btn-primary"
            >
              Done & Return to Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
