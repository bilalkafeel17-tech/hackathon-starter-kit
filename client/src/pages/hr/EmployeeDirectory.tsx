import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import {
  Users,
  Search,
  Plus,
  Upload,
  Download,
  Filter,
  X,
  Eye,
  Mail,
  Phone,
  Calendar,
  Building,
  CreditCard,
  UserX,
} from 'lucide-react';
import { Employee, Department, Designation } from '../../types';

interface EmployeeDirectoryProps {
  onNavigateToRegister: () => void;
  onNavigateToCsv: () => void;
  onSelectEmployee360: (employeeId: string) => void;
  isAdmin?: boolean;
}

export default function EmployeeDirectory({
  onNavigateToRegister,
  onNavigateToCsv,
  onSelectEmployee360,
  isAdmin = false,
}: EmployeeDirectoryProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Quick view drawer
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  useEffect(() => {
    loadData();
  }, [search, deptFilter, statusFilter]);

  async function loadData() {
    setLoading(true);
    try {
      let query = '/employees?limit=100';
      if (search) query += `&search=${encodeURIComponent(search)}`;
      if (deptFilter) query += `&departmentId=${deptFilter}`;
      if (statusFilter) query += `&status=${statusFilter}`;

      const [empRes, deptRes] = await Promise.all([
        apiFetch<Employee[]>(query),
        apiFetch<Department[]>('/departments').catch(() => ({ data: [] })),
      ]);

      if (empRes.data) {
        setEmployees(empRes.data);
      }
      if (deptRes.data) {
        setDepartments(deptRes.data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleExportCsv() {
    try {
      const token = localStorage.getItem('hcm_token');
      const res = await fetch('/api/employees/export', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch (err: any) {
      alert(err.message || 'Could not export CSV');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAdmin ? 'Personnel Registry' : 'Employee Directory'}</h1>
          <p className="page-description">
            Complete active and exited staff records with organizational mappings.
          </p>
        </div>

        {!isAdmin && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onNavigateToCsv}
              className="btn btn-secondary"
            >
              <Upload size={16} strokeWidth={1.75} />
              <span>Import CSV</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="btn btn-primary"
            >
              <Plus size={16} strokeWidth={1.75} />
              <span>Register employee</span>
            </button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search
              size={15}
              strokeWidth={1.75}
              color="var(--color-text-muted)"
              style={{ position: 'absolute', left: 12, top: 12 }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Search code, name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34, height: 38 }}
            />
          </div>

          <select
            className="form-control"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            style={{ width: 180, height: 38 }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 140, height: 38 }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="exited">Exited</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="btn btn-secondary btn-sm"
          title="Export CSV"
        >
          <Download size={14} strokeWidth={1.75} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Code</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Status</th>
              <th>Joining Date</th>
              {isAdmin && <th className="mono-col">Gross Salary</th>}
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 8 : 7}
                  style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}
                >
                  No employees found matching the selected filters.
                </td>
              </tr>
            ) : (
              employees.map((emp) => {
                const deptName =
                  typeof emp.departmentId === 'object' && emp.departmentId !== null
                    ? (emp.departmentId as any).name
                    : '-';
                const desigName =
                  typeof emp.designationId === 'object' && emp.designationId !== null
                    ? (emp.designationId as any).name
                    : '-';

                return (
                  <tr
                    key={emp._id}
                    onClick={() => setSelectedEmp(emp)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-surface-2)',
                            color: 'var(--color-text)',
                            fontSize: 12,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {emp.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectEmployee360(emp._id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-text)',
                              fontWeight: 600,
                              fontSize: 13.5,
                              cursor: 'pointer',
                              textAlign: 'left',
                              padding: 0,
                            }}
                            className="btn-link"
                          >
                            {emp.name}
                          </button>
                          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                            {emp.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="mono-num" style={{ fontWeight: 600 }}>
                      {emp.employeeCode}
                    </td>
                    <td>{deptName}</td>
                    <td>{desigName}</td>
                    <td>
                      <span
                        className={`status-pill ${emp.status === 'active' ? 'status-active' : 'status-danger'}`}
                      >
                        {emp.status}
                      </span>
                    </td>
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {emp.joiningDate}
                    </td>
                    {isAdmin && (
                      <td className="mono-col">
                        {emp.currentSalary
                          ? `Rs. ${(emp.currentSalary.gross / 100).toLocaleString()}`
                          : '-'}
                      </td>
                    )}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEmployee360(emp._id);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <Eye size={13} strokeWidth={1.75} />
                        <span>360</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Quick View Drawer */}
      {selectedEmp && (
        <>
          <div className="overlay-backdrop" onClick={() => setSelectedEmp(null)} />
          <aside className="drawer" style={{ maxWidth: 440 }}>
            <header className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                  }}
                >
                  {selectedEmp.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedEmp.name}</div>
                  <div className="mono-num" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {selectedEmp.employeeCode}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                className="btn-ghost"
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </header>

            <div className="drawer-body">
              <div
                style={{
                  padding: 12,
                  backgroundColor: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-control)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={14} strokeWidth={1.75} color="var(--color-text-muted)" />
                  <span>{selectedEmp.email}</span>
                </div>
                {selectedEmp.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Phone size={14} strokeWidth={1.75} color="var(--color-text-muted)" />
                    <span>{selectedEmp.phone}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={14} strokeWidth={1.75} color="var(--color-text-muted)" />
                  <span>Joined on {selectedEmp.joiningDate}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building size={14} strokeWidth={1.75} color="var(--color-text-muted)" />
                  <span>
                    {typeof selectedEmp.departmentId === 'object' && selectedEmp.departmentId !== null
                      ? (selectedEmp.departmentId as any).name
                      : 'Unassigned department'}
                  </span>
                </div>
              </div>

              {isAdmin && selectedEmp.currentSalary && (
                <div className="card" style={{ padding: 14 }}>
                  <span className="section-label" style={{ marginBottom: 8, display: 'block' }}>
                    Compensation Breakdown
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Basic Salary</span>
                      <span className="mono-num">Rs. {(selectedEmp.currentSalary.basic / 100).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>HRA (40%)</span>
                      <span className="mono-num">Rs. {(selectedEmp.currentSalary.hra / 100).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Medical Allowance (10%)</span>
                      <span className="mono-num">Rs. {(selectedEmp.currentSalary.medical / 100).toLocaleString()}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderTop: '1px solid var(--color-border)',
                        paddingTop: 6,
                        fontWeight: 600,
                      }}
                    >
                      <span>Gross Monthly</span>
                      <span className="mono-num">Rs. {(selectedEmp.currentSalary.gross / 100).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  const id = selectedEmp._id;
                  setSelectedEmp(null);
                  onSelectEmployee360(id);
                }}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 'auto' }}
              >
                <span>Open Employee 360</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
