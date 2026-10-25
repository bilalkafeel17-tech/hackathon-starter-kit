import { useState, ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  Settings,
  Shield,
  FileSpreadsheet,
  Megaphone,
  Menu,
  ChevronLeft,
  LogOut,
  KeyRound,
  Bot,
  UserCheck,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import NotificationDropdown from './NotificationDropdown';
import AiAssistantDrawer from './AiAssistantDrawer';
import { UserProfile, Role } from '../types';

export type NavItemKey =
  | 'admin-dashboard'
  | 'admin-users'
  | 'admin-employees'
  | 'admin-attendance'
  | 'admin-leave'
  | 'admin-payroll'
  | 'admin-settings'
  | 'admin-audit'
  | 'hr-dashboard'
  | 'hr-employees'
  | 'hr-register'
  | 'hr-attendance'
  | 'hr-leave'
  | 'hr-payroll'
  | 'hr-announcements'
  | 'hr-csv'
  | 'emp-dashboard'
  | 'emp-attendance'
  | 'emp-leave'
  | 'emp-payslips'
  | 'emp-profile';

interface LayoutShellProps {
  currentUser: UserProfile;
  activeItem: NavItemKey;
  onNavigate: (item: NavItemKey) => void;
  onSignOut: () => void;
  onOpenChangePassword: () => void;
  breadcrumbs: string[];
  children: ReactNode;
}

export default function LayoutShell({
  currentUser,
  activeItem,
  onNavigate,
  onSignOut,
  onOpenChangePassword,
  breadcrumbs,
  children,
}: LayoutShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const role = currentUser.role;

  interface NavItemDef {
    key: NavItemKey;
    label: string;
    icon: typeof LayoutDashboard;
  }

  interface NavGroup {
    title: string;
    items: NavItemDef[];
  }

  const adminGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [
        { key: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { key: 'admin-audit', label: 'Audit Log', icon: Shield },
      ],
    },
    {
      title: 'Organization',
      items: [
        { key: 'admin-users', label: 'System Users', icon: Users },
        { key: 'admin-employees', label: 'Employees', icon: UserCheck },
        { key: 'admin-attendance', label: 'Attendance Board', icon: CalendarCheck },
        { key: 'admin-leave', label: 'Leave Records', icon: CalendarDays },
        { key: 'admin-payroll', label: 'Payroll Runs', icon: CreditCard },
      ],
    },
    {
      title: 'Configuration',
      items: [{ key: 'admin-settings', label: 'Company Settings', icon: Settings }],
    },
  ];

  const hrGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [{ key: 'hr-dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      title: 'Staff Management',
      items: [
        { key: 'hr-employees', label: 'Employee Directory', icon: Users },
        { key: 'hr-register', label: 'Register Employee', icon: UserCheck },
        { key: 'hr-csv', label: 'CSV Import & Export', icon: FileSpreadsheet },
      ],
    },
    {
      title: 'Operations',
      items: [
        { key: 'hr-attendance', label: 'Attendance & Clock', icon: CalendarCheck },
        { key: 'hr-leave', label: 'Leave Requests', icon: CalendarDays },
        { key: 'hr-payroll', label: 'Payroll Processing', icon: CreditCard },
        { key: 'hr-announcements', label: 'Announcements', icon: Megaphone },
      ],
    },
  ];

  const employeeGroups: NavGroup[] = [
    {
      title: 'Workspace',
      items: [{ key: 'emp-dashboard', label: 'My Dashboard', icon: LayoutDashboard }],
    },
    {
      title: 'Self Service',
      items: [
        { key: 'emp-attendance', label: 'My Attendance', icon: CalendarCheck },
        { key: 'emp-leave', label: 'Request Leave', icon: CalendarDays },
        { key: 'emp-payslips', label: 'Payslips', icon: CreditCard },
        { key: 'emp-profile', label: 'My Profile', icon: Users },
      ],
    },
  ];

  const groups = role === 'admin' ? adminGroups : role === 'hr' ? hrGroups : employeeGroups;

  return (
    <div className="app-shell">
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="overlay-backdrop"
          style={{ zIndex: 35 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          {!collapsed && (
            <div className="wordmark">
              <div className="logo-mark" />
              <span>HCM Lite</span>
            </div>
          )}
          {collapsed && (
            <div className="logo-mark" style={{ margin: '0 auto' }} title="HCM Lite" />
          )}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="btn-ghost"
            style={{
              width: 28,
              height: 28,
              padding: 0,
              color: 'var(--color-sidebar-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse to icon rail'}
            aria-label="Toggle sidebar collapse"
          >
            <ChevronLeft
              size={16}
              strokeWidth={1.75}
              style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}
            />
          </button>
        </div>

        <nav className="sidebar-nav">
          {groups.map((grp, gIdx) => (
            <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!collapsed && <div className="nav-group-title">{grp.title}</div>}
              {grp.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeItem === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onNavigate(item.key);
                      setMobileOpen(false);
                    }}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}
                    style={{
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      padding: collapsed ? '8px 0' : '8px 12px',
                    }}
                  >
                    <IconComponent size={18} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="main-content-wrap">
        {/* Top Bar */}
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="btn-ghost"
              style={{
                display: 'none',
                width: 36,
                height: 36,
                padding: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Open mobile menu"
            >
              <Menu size={18} strokeWidth={1.75} />
            </button>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
              <span>HCM</span>
              <span>/</span>
              {breadcrumbs.map((crumb, idx) => (
                <span
                  key={idx}
                  style={{
                    color: idx === breadcrumbs.length - 1 ? 'var(--color-text)' : 'inherit',
                    fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400,
                  }}
                >
                  {crumb}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Assistant Trigger Button */}
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ gap: 6 }}
            >
              <Bot size={16} strokeWidth={1.75} color="var(--color-accent)" />
              <span>Ask Assistant</span>
            </button>

            {/* Notification Bell */}
            <NotificationDropdown />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Profile Pill & Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="btn-ghost"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-control)',
                  cursor: 'pointer',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
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
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                    {currentUser.name}
                  </span>
                  <span
                    className={`status-pill status-${currentUser.role === 'admin' ? 'warning' : currentUser.role === 'hr' ? 'info' : 'active'}`}
                    style={{ fontSize: 10, padding: '0 4px', width: 'fit-content' }}
                  >
                    {currentUser.role}
                  </span>
                </div>
              </button>

              {userMenuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      width: 220,
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-card)',
                      boxShadow: 'var(--shadow-overlay)',
                      zIndex: 50,
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{currentUser.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{currentUser.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenChangePassword();
                      }}
                      className="btn-ghost"
                      style={{
                        padding: '8px 10px',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        borderRadius: 4,
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <KeyRound size={15} strokeWidth={1.75} />
                      <span>Change Password</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSignOut();
                      }}
                      className="btn-ghost"
                      style={{
                        padding: '8px 10px',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        borderRadius: 4,
                        textAlign: 'left',
                        width: '100%',
                        color: 'var(--color-danger)',
                      }}
                    >
                      <LogOut size={15} strokeWidth={1.75} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-container">{children}</main>
      </div>

      {/* Shared Assistant Drawer */}
      <AiAssistantDrawer
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        userRole={role}
      />
    </div>
  );
}
