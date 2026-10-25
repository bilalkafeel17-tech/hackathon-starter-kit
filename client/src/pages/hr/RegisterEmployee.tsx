import { useState, useEffect, FormEvent } from 'react';
import { apiFetch } from '../../api/client';
import {
  User,
  Briefcase,
  CreditCard,
  CheckCircle2,
  Copy,
  Printer,
  X,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { Department, Designation } from '../../types';

interface RegisterEmployeeProps {
  onSuccessReturn: () => void;
}

export default function RegisterEmployee({ onSuccessReturn }: RegisterEmployeeProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Departments & Designations
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);

  // Step 1: Personal
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Step 2: Job
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [employmentType, setEmploymentType] = useState<'full_time' | 'part_time' | 'contract'>('full_time');

  // Step 3: Salary
  const [salaryInput, setSalaryInput] = useState('100000');

  // Calculation in rupees
  const grossRupees = Math.max(0, Number(salaryInput) || 0);
  const basicRupees = Math.round(grossRupees / 1.5);
  const hraRupees = Math.round(basicRupees * 0.4);
  const medicalRupees = grossRupees - basicRupees - hraRupees;

  // UI & Credentials modal
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [credentialsModal, setCredentialsModal] = useState<{
    employeeCode: string;
    email: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadMetadata();
  }, []);

  async function loadMetadata() {
    try {
      const [deptRes, desigRes] = await Promise.all([
        apiFetch<Department[]>('/departments'),
        apiFetch<Designation[]>('/designations'),
      ]);
      if (deptRes.data) setDepartments(deptRes.data);
      if (desigRes.data) setDesignations(desigRes.data);
    } catch {
      // Ignore
    }
  }

  const filteredDesignations = designations.filter(
    (d) => !departmentId || (typeof d.departmentId === 'object' ? (d.departmentId as any)._id === departmentId : d.departmentId === departmentId)
  );

  async function handleSubmit() {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const grossCents = Math.round(grossRupees * 100);

      const res = await apiFetch<any>('/employees', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          departmentId,
          designationId,
          joiningDate,
          employmentType,
          initialSalary: grossCents,
        }),
      });

      if (res.data) {
        setCredentialsModal({
          employeeCode: res.data.employee.employeeCode,
          email: res.data.employee.email,
          tempPassword: res.data.temporaryPassword || res.data.tempPassword || 'Pass1234',
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to register employee');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const steps = [
    { num: 1, label: 'Personal Information', desc: 'Contact & identity details', icon: User },
    { num: 2, label: 'Job Assignment', desc: 'Department & designation', icon: Briefcase },
    { num: 3, label: 'Compensation', desc: 'Salary & allowances', icon: CreditCard },
    { num: 4, label: 'Verification & Review', desc: 'Review & issue credentials', icon: CheckCircle2 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Register Employee</h1>
          <p className="page-description">
            Onboard a new staff member with automated employee code, initial salary version, and system login credentials.
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

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'flex-start' }}>
        {/* Left Vertical Stepper */}
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isCurrent = step === s.num;
            const isDone = step > s.num;

            return (
              <div
                key={s.num}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-control)',
                  backgroundColor: isCurrent ? 'var(--color-surface-2)' : 'transparent',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: isDone
                      ? 'var(--color-success)'
                      : isCurrent
                      ? 'var(--color-primary)'
                      : 'var(--color-surface-2)',
                    color: isDone || isCurrent ? '#FFFFFF' : 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {isDone ? <CheckCircle2 size={16} strokeWidth={2} /> : s.num}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 500, color: 'var(--color-text)' }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>{s.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Form Card */}
        <div className="card" style={{ padding: 24, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
          {errorMessage && (
            <div
              style={{
                marginBottom: 16,
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

          {/* STEP 1: Personal */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Personal Information</h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Enter official contact details for this employee.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. Tariq Mehmood"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Official Work Email *</label>
                <input
                  type="email"
                  required
                  className="form-control"
                  placeholder="e.g. tariq.mehmood@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="e.g. +92 300 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Residential Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. House 42, Street 8, Karachi"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Job */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Job & Department Assignment</h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Place employee into the organizational structure.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Department *</label>
                <select
                  required
                  className="form-control"
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    setDesignationId('');
                  }}
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Designation *</label>
                <select
                  required
                  className="form-control"
                  value={designationId}
                  onChange={(e) => setDesignationId(e.target.value)}
                  disabled={!departmentId}
                >
                  <option value="">Select Designation...</option>
                  {filteredDesignations.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Official Joining Date *</label>
                <input
                  type="date"
                  required
                  className="form-control mono-num"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Employment Type *</label>
                <select
                  className="form-control"
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as any)}
                >
                  <option value="full_time">Full-Time</option>
                  <option value="part_time">Part-Time</option>
                  <option value="contract">Contractor</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 3: Salary */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Compensation Setup</h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Enter initial gross monthly salary. Statutory allowances (HRA 40%, Medical 10%) calculate automatically.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Monthly Gross Salary (PKR) *</label>
                <input
                  type="number"
                  min={1000}
                  step={500}
                  required
                  className="form-control mono-num"
                  placeholder="100000"
                  value={salaryInput}
                  onChange={(e) => setSalaryInput(e.target.value)}
                />
              </div>

              {/* Live Salary Breakdown Card */}
              <div
                style={{
                  padding: 16,
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <span className="section-label">Live Salary Breakdown</span>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Basic Salary</span>
                  <span className="mono-num" style={{ fontWeight: 600 }}>Rs. {basicRupees.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>House Rent Allowance (HRA 40%)</span>
                  <span className="mono-num" style={{ fontWeight: 600 }}>Rs. {hraRupees.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Medical Allowance (10%)</span>
                  <span className="mono-num" style={{ fontWeight: 600 }}>Rs. {medicalRupees.toLocaleString()}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 14,
                    fontWeight: 700,
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: 8,
                  }}
                >
                  <span>Gross Monthly Total</span>
                  <span className="mono-num" style={{ color: 'var(--color-accent)' }}>Rs. {grossRupees.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Review Employee Profile</h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Confirm all fields before issuing system credentials.</p>
              </div>

              <div
                style={{
                  padding: 16,
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-card)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Legal Name: </span>
                  <strong>{name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Official Email: </span>
                  <strong>{email}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Joining Date: </span>
                  <span className="mono-num">{joiningDate}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Employment Type: </span>
                  <span style={{ textTransform: 'capitalize' }}>{employmentType.replace('_', ' ')}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Department: </span>
                  <strong>{departments.find((d) => d._id === departmentId)?.name || '-'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Designation: </span>
                  <strong>{designations.find((d) => d._id === designationId)?.name || '-'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Gross Monthly: </span>
                  <strong className="mono-num">Rs. {grossRupees.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Footer Controls */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 24,
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="btn btn-secondary"
              >
                <ArrowLeft size={16} strokeWidth={1.75} />
                <span>Back</span>
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && (!name.trim() || !email.trim())) {
                    setErrorMessage('Please enter legal name and work email');
                    return;
                  }
                  if (step === 2 && (!departmentId || !designationId)) {
                    setErrorMessage('Please select department and designation');
                    return;
                  }
                  setErrorMessage(null);
                  setStep((s) => (s + 1) as any);
                }}
                className="btn btn-primary"
              >
                <span>Continue</span>
                <ArrowRight size={16} strokeWidth={1.75} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="btn btn-primary"
              >
                <span>{submitting ? 'Registering...' : 'Register employee'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* One-Time Credentials Modal */}
      {credentialsModal && (
        <div className="overlay-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Employee Registered Successfully</h2>
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
                <span>This temporary password will only be shown once. Deliver it to the employee now.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Employee Code</label>
                <input
                  type="text"
                  readOnly
                  className="form-control mono-num"
                  value={credentialsModal.employeeCode}
                  style={{ fontWeight: 600 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Login Email</label>
                <input
                  type="text"
                  readOnly
                  className="form-control"
                  value={credentialsModal.email}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Temporary Password</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    className="form-control mono-num"
                    value={credentialsModal.tempPassword}
                    style={{ fontWeight: 600 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(credentialsModal.tempPassword)}
                    className="btn btn-secondary"
                  >
                    {copied ? <CheckCircle2 size={16} strokeWidth={1.75} color="var(--color-success)" /> : <Copy size={16} strokeWidth={1.75} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-secondary"
              >
                <Printer size={15} strokeWidth={1.75} />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={onSuccessReturn}
                className="btn btn-primary"
              >
                Done & Return to Directory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
