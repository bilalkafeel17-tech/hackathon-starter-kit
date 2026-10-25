import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import {
  Building2,
  Clock,
  MapPin,
  CalendarDays,
  ListTodo,
  Layers,
  Award,
  Plus,
  Trash2,
  Save,
  Check,
  AlertCircle,
  Navigation,
} from 'lucide-react';
import { Department, Designation, LeaveType, Holiday } from '../../types';

type SettingsTab =
  | 'company'
  | 'hours'
  | 'location'
  | 'holidays'
  | 'leaveTypes'
  | 'departments'
  | 'designations';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings state
  const [companyName, setCompanyName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('18:00');
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(15);
  const [halfDayHoursThreshold, setHalfDayHoursThreshold] = useState(5);
  const [weekendDays, setWeekendDays] = useState<number[]>([0, 6]);

  // Office Location
  const [officeLat, setOfficeLat] = useState<number | ''>(24.8607);
  const [officeLng, setOfficeLng] = useState<number | ''>(67.0011);
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(250);

  // Dynamic entities
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // New item inputs
  const [newDeptName, setNewDeptName] = useState('');
  const [newDesigName, setNewDesigName] = useState('');
  const [newDesigDeptId, setNewDesigDeptId] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const [settingsRes, deptRes, desigRes, ltRes, holRes] = await Promise.all([
        apiFetch<any>('/settings').catch(() => ({ data: null })),
        apiFetch<Department[]>('/departments').catch(() => ({ data: [] })),
        apiFetch<Designation[]>('/designations').catch(() => ({ data: [] })),
        apiFetch<LeaveType[]>('/leave-types').catch(() => ({ data: [] })),
        apiFetch<Holiday[]>('/holidays').catch(() => ({ data: [] })),
      ]);

      if (settingsRes.data) {
        const s = settingsRes.data;
        setCompanyName(s.companyName || '');
        setTimezone(s.timezone || 'Asia/Karachi');
        setWorkStartTime(s.workStartTime || '09:00');
        setWorkEndTime(s.workEndTime || '18:00');
        setGracePeriodMinutes(s.gracePeriodMinutes ?? 15);
        setHalfDayHoursThreshold(s.halfDayHoursThreshold ?? 5);
        setWeekendDays(s.weekendDays || [0, 6]);
        if (s.officeLocation) {
          setOfficeLat(s.officeLocation.latitude ?? 24.8607);
          setOfficeLng(s.officeLocation.longitude ?? 67.0011);
          setGeofenceRadiusMeters(s.officeLocation.geofenceRadiusMeters ?? 250);
        }
      }

      setDepartments(deptRes.data || []);
      setDesignations(desigRes.data || []);
      setLeaveTypes(ltRes.data || []);
      setHolidays(holRes.data || []);
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficeLat(Number(pos.coords.latitude.toFixed(6)));
        setOfficeLng(Number(pos.coords.longitude.toFixed(6)));
        setDirty(true);
      },
      (err) => {
        alert('Could not determine your location: ' + err.message);
      }
    );
  }

  async function handleSaveSettings() {
    setSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const body: any = {
        companyName,
        timezone,
        workStartTime,
        workEndTime,
        gracePeriodMinutes,
        halfDayHoursThreshold,
        weekendDays,
      };

      if (officeLat !== '' && officeLng !== '') {
        body.officeLocation = {
          latitude: Number(officeLat),
          longitude: Number(officeLng),
          geofenceRadiusMeters: Number(geofenceRadiusMeters),
        };
      }

      await apiFetch('/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      setDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  // Create Department
  async function handleAddDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    try {
      const res = await apiFetch<Department>('/departments', {
        method: 'POST',
        body: JSON.stringify({ name: newDeptName.trim() }),
      });
      if (res.data) {
        setDepartments((prev) => [...prev, res.data!]);
        setNewDeptName('');
      }
    } catch (err: any) {
      alert(err.message || 'Could not add department');
    }
  }

  // Create Designation
  async function handleAddDesignation(e: React.FormEvent) {
    e.preventDefault();
    if (!newDesigName.trim() || !newDesigDeptId) return;
    try {
      const res = await apiFetch<Designation>('/designations', {
        method: 'POST',
        body: JSON.stringify({
          name: newDesigName.trim(),
          departmentId: newDesigDeptId,
        }),
      });
      if (res.data) {
        setDesignations((prev) => [...prev, res.data!]);
        setNewDesigName('');
      }
    } catch (err: any) {
      alert(err.message || 'Could not add designation');
    }
  }

  // Create Holiday
  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!newHolidayName.trim() || !newHolidayDate) return;
    try {
      const res = await apiFetch<Holiday>('/holidays', {
        method: 'POST',
        body: JSON.stringify({
          name: newHolidayName.trim(),
          dateKey: newHolidayDate,
        }),
      });
      if (res.data) {
        setHolidays((prev) => [...prev, res.data!]);
        setNewHolidayName('');
        setNewHolidayDate('');
      }
    } catch (err: any) {
      alert(err.message || 'Could not add holiday');
    }
  }

  // Apply default leave suggestions if empty
  async function handleApplyLeaveSuggestions() {
    try {
      const res = await apiFetch<LeaveType[]>('/leave-types/suggestions/apply', { method: 'POST' });
      if (res.data) {
        setLeaveTypes(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Could not seed leave suggestions');
    }
  }

  const navItems = [
    { key: 'company', label: 'Company Profile', icon: Building2 },
    { key: 'hours', label: 'Office Hours & Schedule', icon: Clock },
    { key: 'location', label: 'Office Coordinates & Geofence', icon: MapPin },
    { key: 'holidays', label: 'Public Holidays', icon: CalendarDays },
    { key: 'leaveTypes', label: 'Leave Types & Quotas', icon: ListTodo },
    { key: 'departments', label: 'Departments', icon: Layers },
    { key: 'designations', label: 'Designations', icon: Award },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Settings</h1>
          <p className="page-description">Manage enterprise rules, working schedules, coordinates, and organizational units.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'flex-start' }}>
        {/* Left Vertical Sub-Nav */}
        <div className="card" style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key as SettingsTab)}
                className={`nav-item ${isActive ? 'active' : ''}`}
                style={{
                  color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
                  backgroundColor: isActive ? 'var(--color-surface-2)' : 'transparent',
                }}
              >
                <Icon size={16} strokeWidth={1.75} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Active Panel */}
        <div className="card" style={{ padding: 24, position: 'relative', minHeight: 480 }}>
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

          {/* TAB 1: Company Profile */}
          {activeTab === 'company' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Company Profile</h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Enterprise identity and primary operating timezone.</p>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="companyNameField">Company Legal Name</label>
                <input
                  id="companyNameField"
                  type="text"
                  className="form-control"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="tzField">Primary Operating Timezone</label>
                <select
                  id="tzField"
                  className="form-control"
                  value={timezone}
                  onChange={(e) => {
                    setTimezone(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="Asia/Karachi">Asia/Karachi (PKT, UTC+5)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 2: Office Hours & Schedule */}
          {activeTab === 'hours' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Office Hours & Shifts</h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Working shift times, late arrival grace window, and half-day duration.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="startTimeField">Shift Start Time (HH:mm)</label>
                  <input
                    id="startTimeField"
                    type="time"
                    className="form-control"
                    value={workStartTime}
                    onChange={(e) => {
                      setWorkStartTime(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="endTimeField">Shift End Time (HH:mm)</label>
                  <input
                    id="endTimeField"
                    type="time"
                    className="form-control"
                    value={workEndTime}
                    onChange={(e) => {
                      setWorkEndTime(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="graceField">Grace Period (Minutes after shift start)</label>
                  <input
                    id="graceField"
                    type="number"
                    min={0}
                    max={60}
                    className="form-control mono-num"
                    value={gracePeriodMinutes}
                    onChange={(e) => {
                      setGracePeriodMinutes(Number(e.target.value));
                      setDirty(true);
                    }}
                  />
                  <span style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>
                    Check-in beyond {workStartTime} + {gracePeriodMinutes}m is marked 'late'.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="halfDayField">Half-day Threshold (Minimum hours)</label>
                  <input
                    id="halfDayField"
                    type="number"
                    min={1}
                    max={8}
                    className="form-control mono-num"
                    value={halfDayHoursThreshold}
                    onChange={(e) => {
                      setHalfDayHoursThreshold(Number(e.target.value));
                      setDirty(true);
                    }}
                  />
                  <span style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>
                    Working less than {halfDayHoursThreshold} hours registers as 'half_day'.
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Company Weekend Days</label>
                <div style={{ display: 'flex', gap: 16 }}>
                  {[
                    { label: 'Sunday', value: 0 },
                    { label: 'Saturday', value: 6 },
                    { label: 'Friday', value: 5 },
                  ].map((d) => {
                    const checked = weekendDays.includes(d.value);
                    return (
                      <label key={d.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWeekendDays([...weekendDays, d.value]);
                            } else {
                              setWeekendDays(weekendDays.filter((x) => x !== d.value));
                            }
                            setDirty(true);
                          }}
                        />
                        <span>{d.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Office Coordinates & Geofence */}
          {activeTab === 'location' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Office Geofencing</h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Physical office coordinates for mobile/camera check-in distance verification.
                </p>
              </div>

              <div
                style={{
                  padding: 16,
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-detect Location</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    Fill latitude and longitude from your current browser GPS coordinates.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="btn btn-secondary btn-sm"
                >
                  <Navigation size={14} strokeWidth={1.75} style={{ marginRight: 6 }} />
                  Use my current location
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="latField">Latitude</label>
                  <input
                    id="latField"
                    type="number"
                    step="0.000001"
                    className="form-control mono-num"
                    value={officeLat}
                    onChange={(e) => {
                      setOfficeLat(e.target.value === '' ? '' : Number(e.target.value));
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="lngField">Longitude</label>
                  <input
                    id="lngField"
                    type="number"
                    step="0.000001"
                    className="form-control mono-num"
                    value={officeLng}
                    onChange={(e) => {
                      setOfficeLng(e.target.value === '' ? '' : Number(e.target.value));
                      setDirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="form-label" htmlFor="radiusRange">Allowed Geofence Radius</label>
                  <span className="mono-num" style={{ fontWeight: 600 }}>{geofenceRadiusMeters} meters</span>
                </div>
                <input
                  id="radiusRange"
                  type="range"
                  min={50}
                  max={2000}
                  step={50}
                  value={geofenceRadiusMeters}
                  onChange={(e) => {
                    setGeofenceRadiusMeters(Number(e.target.value));
                    setDirty(true);
                  }}
                  style={{ width: '100%', accentColor: 'var(--color-accent)' }}
                />
              </div>

              <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                When employees use camera attendance, their location coordinates are checked against this office point. If the calculated distance exceeds {geofenceRadiusMeters} meters, the check-in is flagged.
              </div>
            </div>
          )}

          {/* TAB 4: Public Holidays */}
          {activeTab === 'holidays' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Public Holidays</h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Official non-working holidays excluded from employee leave balance deduction.</p>
              </div>

              <form onSubmit={handleAddHoliday} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Holiday Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Independence Day"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ width: 180 }}>
                  <label className="form-label">Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    className="form-control mono-num"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ height: 40 }}>
                  <Plus size={16} strokeWidth={1.75} />
                  <span>Add Holiday</span>
                </button>
              </form>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Holiday Name</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>
                          No public holidays recorded yet.
                        </td>
                      </tr>
                    ) : (
                      holidays.map((h) => (
                        <tr key={h._id}>
                          <td style={{ fontWeight: 500 }}>{h.name}</td>
                          <td className="mono-num">{h.dateKey}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: Leave Types */}
          {activeTab === 'leaveTypes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 600 }}>Leave Types & Quotas</h2>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Configured annual allowances per category.</p>
                </div>
                {leaveTypes.length === 0 && (
                  <button
                    type="button"
                    onClick={handleApplyLeaveSuggestions}
                    className="btn btn-secondary btn-sm"
                  >
                    Load standard suggestions
                  </button>
                )}
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Leave Category</th>
                      <th>Code</th>
                      <th>Paid / Unpaid</th>
                      <th className="mono-col">Annual Quota</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveTypes.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>
                          No leave categories created. Click "Load standard suggestions" to configure standard Pakistani labor quotas (Annual 14, Casual 10, Sick 8, Unpaid).
                        </td>
                      </tr>
                    ) : (
                      leaveTypes.map((lt) => (
                        <tr key={lt._id}>
                          <td style={{ fontWeight: 500 }}>{lt.name}</td>
                          <td className="mono-num">{lt.code}</td>
                          <td>
                            <span className={`status-pill ${lt.isPaid ? 'status-active' : 'status-neutral'}`}>
                              {lt.isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td className="mono-col">
                            {lt.yearlyQuota !== null ? `${lt.yearlyQuota} days` : 'Unlimited'}
                          </td>
                          <td>
                            <span className={`status-pill ${lt.isActive ? 'status-active' : 'status-danger'}`}>
                              {lt.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: Departments */}
          {activeTab === 'departments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Organizational Departments</h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Business units and functional divisions.</p>
              </div>

              <form onSubmit={handleAddDepartment} style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Engineering, Sales, Human Resources"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>
                  <Plus size={16} strokeWidth={1.75} />
                  <span>Add Department</span>
                </button>
              </form>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Department Name</th>
                      <th>Code</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>
                          No departments defined.
                        </td>
                      </tr>
                    ) : (
                      departments.map((dept) => (
                        <tr key={dept._id}>
                          <td style={{ fontWeight: 500 }}>{dept.name}</td>
                          <td className="mono-num">{dept.code}</td>
                          <td>
                            <span className={`status-pill ${dept.isActive ? 'status-active' : 'status-danger'}`}>
                              {dept.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: Designations */}
          {activeTab === 'designations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Job Titles & Designations</h2>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Roles mapped within specific departments.</p>
              </div>

              <form onSubmit={handleAddDesignation} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Senior Software Engineer"
                  value={newDesigName}
                  onChange={(e) => setNewDesigName(e.target.value)}
                />
                <select
                  className="form-control"
                  value={newDesigDeptId}
                  onChange={(e) => setNewDesigDeptId(e.target.value)}
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} strokeWidth={1.75} />
                  <span>Add Designation</span>
                </button>
              </form>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Designation Title</th>
                      <th>Department</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {designations.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>
                          No designations configured.
                        </td>
                      </tr>
                    ) : (
                      designations.map((desig) => {
                        const deptObj =
                          typeof desig.departmentId === 'object'
                            ? desig.departmentId
                            : departments.find((d) => d._id === desig.departmentId);
                        return (
                          <tr key={desig._id}>
                            <td style={{ fontWeight: 500 }}>{desig.name}</td>
                            <td>{deptObj?.name || 'Unassigned'}</td>
                            <td>
                              <span className={`status-pill ${desig.isActive ? 'status-active' : 'status-danger'}`}>
                                {desig.isActive ? 'Active' : 'Inactive'}
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
          )}

          {/* Sticky Save Bar for form panels */}
          {['company', 'hours', 'location'].includes(activeTab) && (
            <div
              style={{
                marginTop: 32,
                paddingTop: 16,
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 13, color: dirty ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                {dirty ? 'You have unsaved changes' : saveSuccess ? 'Settings saved successfully' : 'All settings up to date'}
              </div>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={saving || !dirty}
                className="btn btn-primary"
              >
                <Save size={16} strokeWidth={1.75} />
                <span>{saving ? 'Saving...' : 'Save changes'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
