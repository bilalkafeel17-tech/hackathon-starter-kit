import { useState, useEffect, FormEvent } from 'react';
import { apiFetch } from '../../api/client';
import { User, Phone, MapPin, Mail, Calendar, Building, Briefcase, Save, Check } from 'lucide-react';
import { Employee } from '../../types';

export default function EmployeeProfile() {
  const [profile, setProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/employees/me');
      if (res.data) {
        setProfile(res.data);
        setPhone(res.data.phone || '');
        setAddress(res.data.address || '');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveContact(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/employees/me/contact', {
        method: 'PATCH',
        body: JSON.stringify({
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
        }),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Could not update contact information');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading employee profile...
      </div>
    );
  }

  const deptName =
    typeof profile.departmentId === 'object' && profile.departmentId !== null
      ? (profile.departmentId as any).name
      : 'Unassigned department';

  const desigName =
    typeof profile.designationId === 'object' && profile.designationId !== null
      ? (profile.designationId as any).name
      : 'Unassigned designation';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Employee Profile</h1>
          <p className="page-description">Official personnel identification and editable personal contact details.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 20, alignItems: 'flex-start' }}>
        {/* Read-Only Details in Two Columns */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span className="section-label">Official Employment Record</span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13.5 }}>
            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Legal Name</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{profile.name}</div>
            </div>

            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Employee Code</div>
              <div className="mono-num" style={{ fontWeight: 600, marginTop: 2 }}>
                {profile.employeeCode}
              </div>
            </div>

            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Official Work Email</div>
              <div style={{ marginTop: 2 }}>{profile.email}</div>
            </div>

            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Account Status</div>
              <div style={{ marginTop: 2 }}>
                <span className={`status-pill status-${profile.status === 'active' ? 'active' : 'danger'}`}>
                  {profile.status}
                </span>
              </div>
            </div>

            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Department</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{deptName}</div>
            </div>

            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Designation</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{desigName}</div>
            </div>

            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Joining Date</div>
              <div className="mono-num" style={{ marginTop: 2 }}>{profile.joiningDate}</div>
            </div>

            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Employment Type</div>
              <div style={{ marginTop: 2, textTransform: 'capitalize' }}>
                {profile.employmentType?.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Small Form for Editable Phone & Address */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Contact Details</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
              Update your personal contact telephone and home address.
            </p>
          </div>

          {savedSuccess && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--color-success-soft)',
                border: '1px solid var(--color-success)',
                borderRadius: 'var(--radius-control)',
                fontSize: 12.5,
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Check size={14} strokeWidth={2} />
              <span>Contact information updated successfully.</span>
            </div>
          )}

          <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="phoneInput">Contact Phone</label>
              <input
                id="phoneInput"
                type="tel"
                className="form-control"
                placeholder="+92 300 1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="addressInput">Residential Address</label>
              <textarea
                id="addressInput"
                className="form-control input-textarea"
                rows={3}
                placeholder="House / Street address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ marginTop: 4 }}
            >
              <Save size={15} strokeWidth={1.75} />
              <span>{saving ? 'Saving...' : 'Save contact information'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
