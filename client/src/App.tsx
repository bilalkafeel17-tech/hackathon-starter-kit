import { useState, useEffect, useCallback } from 'react';
import { apiFetch, fetchHealth } from './api/client';
import { UserProfile, AuthResponse, Toast } from './types';
import ToastContainer from './components/Toast';
import LayoutShell, { NavItemKey } from './components/LayoutShell';
import ChangePasswordModal from './components/ChangePasswordModal';
import AuthPages from './pages/AuthPages';

// Admin screens
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminSettings from './pages/admin/AdminSettings';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAudit from './pages/admin/AdminAudit';

// HR screens
import HrDashboard from './pages/hr/HrDashboard';
import EmployeeDirectory from './pages/hr/EmployeeDirectory';
import RegisterEmployee from './pages/hr/RegisterEmployee';
import Employee360 from './pages/hr/Employee360';
import CsvWizard from './pages/hr/CsvWizard';
import AnnouncementsPage from './pages/hr/AnnouncementsPage';

// Shared screens
import AttendanceBoard from './pages/shared/AttendanceBoard';
import LeaveInbox from './pages/shared/LeaveInbox';
import PayrollRuns from './pages/shared/PayrollRuns';

// Employee screens
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeAttendance from './pages/employee/EmployeeAttendance';
import EmployeeLeave from './pages/employee/EmployeeLeave';
import EmployeePayslips from './pages/employee/EmployeePayslips';
import EmployeeProfile from './pages/employee/EmployeeProfile';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isSetupDone, setIsSetupDone] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Active navigation view
  const [activeItem, setActiveItem] = useState<NavItemKey>('admin-dashboard');
  const [selected360Id, setSelected360Id] = useState<string | null>(null);

  // Modals
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: 'success' | 'warning' | 'danger' | 'info', message: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const checkInitialState = useCallback(async () => {
    setLoading(true);
    setServerError(null);

    try {
      // 1. Check server health & setup status
      const setupRes = await apiFetch<{ initialized: boolean }>('/setup/status');
      const initialized = setupRes.data?.initialized ?? false;
      setIsSetupDone(initialized);

      if (initialized) {
        // 2. Check if active token exists in storage
        const token = localStorage.getItem('hcm_token');
        if (token) {
          try {
            const meRes = await apiFetch<UserProfile>('/auth/me');
            if (meRes.data) {
              setCurrentUser(meRes.data);
              setDefaultView(meRes.data.role);
            } else {
              localStorage.removeItem('hcm_token');
              setCurrentUser(null);
            }
          } catch {
            localStorage.removeItem('hcm_token');
            setCurrentUser(null);
          }
        }
      }
    } catch (err: any) {
      setServerError('Unable to reach server. Please ensure backend service is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkInitialState();
  }, [checkInitialState]);

  function setDefaultView(role: string) {
    if (role === 'admin') setActiveItem('admin-dashboard');
    else if (role === 'hr') setActiveItem('hr-dashboard');
    else setActiveItem('emp-dashboard');
  }

  function handleAuthSuccess(data: AuthResponse) {
    localStorage.setItem('hcm_token', data.token);
    setCurrentUser(data.user);
    setIsSetupDone(true);
    setDefaultView(data.user.role);
    addToast('success', `Signed in as ${data.user.name}`);
  }

  function handleSignOut() {
    localStorage.removeItem('hcm_token');
    setCurrentUser(null);
    addToast('info', 'Signed out of workspace');
  }

  // Determine breadcrumb path
  function getBreadcrumbs(): string[] {
    const map: Record<string, string[]> = {
      'admin-dashboard': ['Overview', 'Dashboard'],
      'admin-users': ['Organization', 'System Users'],
      'admin-employees': ['Organization', 'Personnel Registry'],
      'admin-attendance': ['Organization', 'Attendance Board'],
      'admin-leave': ['Organization', 'Leave Records'],
      'admin-payroll': ['Organization', 'Payroll Runs'],
      'admin-settings': ['Configuration', 'Settings'],
      'admin-audit': ['System', 'Audit Trail'],
      'hr-dashboard': ['Overview', 'Dashboard'],
      'hr-employees': ['Staff Management', 'Employee Directory'],
      'hr-register': ['Staff Management', 'Register Employee'],
      'hr-csv': ['Staff Management', 'CSV Import'],
      'hr-attendance': ['Operations', 'Attendance Board'],
      'hr-leave': ['Operations', 'Leave Inbox'],
      'hr-payroll': ['Operations', 'Payroll Processing'],
      'hr-announcements': ['Operations', 'Announcements'],
      'emp-dashboard': ['Workspace', 'Dashboard'],
      'emp-attendance': ['Self Service', 'My Attendance'],
      'emp-leave': ['Self Service', 'Request Leave'],
      'emp-payslips': ['Self Service', 'Payslips'],
      'emp-profile': ['Self Service', 'My Profile'],
    };

    if (selected360Id) {
      return ['Staff Management', 'Employee Directory', 'Employee 360'];
    }
    return map[activeItem] || ['Home'];
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
        }}
      >
        <div className="logo-mark" style={{ width: 32, height: 32 }} />
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600 }}>
          HCM Lite
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Loading enterprise workspace...
        </div>
      </div>
    );
  }

  // Not initialized -> First-Run Setup
  if (!isSetupDone) {
    return (
      <>
        <AuthPages
          mode="setup"
          onAuthSuccess={handleAuthSuccess}
          serverError={serverError || undefined}
          onRetryConnection={checkInitialState}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Initialized, but not logged in -> Login
  if (!currentUser) {
    return (
      <>
        <AuthPages
          mode="login"
          onAuthSuccess={handleAuthSuccess}
          serverError={serverError || undefined}
          onRetryConnection={checkInitialState}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const role = currentUser.role;

  return (
    <>
      <LayoutShell
        currentUser={currentUser}
        activeItem={activeItem}
        onNavigate={(item) => {
          setSelected360Id(null);
          setActiveItem(item);
        }}
        onSignOut={handleSignOut}
        onOpenChangePassword={() => setChangePasswordOpen(true)}
        breadcrumbs={getBreadcrumbs()}
      >
        {/* Render View Based on Active Selection and Role */}

        {/* Employee 360 View */}
        {selected360Id ? (
          <Employee360
            employeeId={selected360Id}
            onBack={() => setSelected360Id(null)}
            isAdmin={role === 'admin'}
          />
        ) : (
          <>
            {/* ADMIN ROUTES */}
            {activeItem === 'admin-dashboard' && (
              <AdminDashboard onNavigate={(key) => setActiveItem(key as NavItemKey)} />
            )}
            {activeItem === 'admin-settings' && <AdminSettings />}
            {activeItem === 'admin-users' && <AdminUsers />}
            {activeItem === 'admin-employees' && (
              <EmployeeDirectory
                isAdmin
                onNavigateToRegister={() => {}}
                onNavigateToCsv={() => {}}
                onSelectEmployee360={(id) => setSelected360Id(id)}
              />
            )}
            {activeItem === 'admin-attendance' && <AttendanceBoard isAdmin />}
            {activeItem === 'admin-leave' && <LeaveInbox isAdmin />}
            {activeItem === 'admin-payroll' && <PayrollRuns isAdmin />}
            {activeItem === 'admin-audit' && <AdminAudit />}

            {/* HR ROUTES */}
            {activeItem === 'hr-dashboard' && (
              <HrDashboard onNavigate={(key) => setActiveItem(key as NavItemKey)} />
            )}
            {activeItem === 'hr-employees' && (
              <EmployeeDirectory
                onNavigateToRegister={() => setActiveItem('hr-register')}
                onNavigateToCsv={() => setActiveItem('hr-csv')}
                onSelectEmployee360={(id) => setSelected360Id(id)}
              />
            )}
            {activeItem === 'hr-register' && (
              <RegisterEmployee onSuccessReturn={() => setActiveItem('hr-employees')} />
            )}
            {activeItem === 'hr-csv' && (
              <CsvWizard onSuccessReturn={() => setActiveItem('hr-employees')} />
            )}
            {activeItem === 'hr-attendance' && <AttendanceBoard />}
            {activeItem === 'hr-leave' && <LeaveInbox />}
            {activeItem === 'hr-payroll' && <PayrollRuns />}
            {activeItem === 'hr-announcements' && <AnnouncementsPage userRole="hr" />}

            {/* EMPLOYEE ROUTES */}
            {activeItem === 'emp-dashboard' && (
              <EmployeeDashboard
                onNavigate={(key) => setActiveItem(key as NavItemKey)}
                onOpenAssistant={() => {}}
              />
            )}
            {activeItem === 'emp-attendance' && <EmployeeAttendance />}
            {activeItem === 'emp-leave' && <EmployeeLeave />}
            {activeItem === 'emp-payslips' && <EmployeePayslips />}
            {activeItem === 'emp-profile' && <EmployeeProfile />}
          </>
        )}
      </LayoutShell>

      {/* Mandatory or User-Initiated Password Change Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen || !!currentUser.mustChangePassword}
        forced={!!currentUser.mustChangePassword}
        onClose={() => setChangePasswordOpen(false)}
        onSuccess={() => {
          setChangePasswordOpen(false);
          setCurrentUser((u) => (u ? { ...u, mustChangePassword: false } : null));
          addToast('success', 'Password updated successfully');
        }}
      />

      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
