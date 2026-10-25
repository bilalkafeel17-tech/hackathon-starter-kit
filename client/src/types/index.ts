export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  };
}

export type Role = 'admin' | 'hr' | 'employee';

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: Role;
  employeeId?: string;
  mustChangePassword?: boolean;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
  mustChangePassword?: boolean;
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface Designation {
  _id: string;
  name: string;
  departmentId: string | Department;
  isActive: boolean;
}

export interface LeaveType {
  _id: string;
  name: string;
  code: string;
  isPaid: boolean;
  yearlyQuota: number | null;
  isActive: boolean;
}

export interface Holiday {
  _id: string;
  name: string;
  dateKey: string;
}

export interface Employee {
  _id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  departmentId?: string | { _id: string; name: string; code: string };
  designationId?: string | { _id: string; name: string };
  joiningDate: string;
  status: 'active' | 'exited';
  employmentType: 'full_time' | 'part_time' | 'contract';
  initialSalary?: number;
  currentSalary?: {
    basic: number;
    hra: number;
    medical: number;
    gross: number;
  };
}

export interface AttendanceRecord {
  _id: string;
  employeeId: string | { _id: string; employeeCode: string; name: string };
  dateKey: string;
  checkIn?: string;
  checkOut?: string;
  status: 'present' | 'late' | 'half_day' | 'absent' | 'on_leave';
  workHours?: number;
  source: 'web' | 'camera' | 'correction';
}

export interface CorrectionRequest {
  _id: string;
  employeeId: string | { _id: string; employeeCode: string; name: string };
  dateKey: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decisionComment?: string;
  createdAt: string;
}

export interface LeaveRequest {
  _id: string;
  employeeId: string | { _id: string; employeeCode: string; name: string; email: string };
  leaveTypeId: string | { _id: string; name: string; code: string; isPaid: boolean };
  startDate: string;
  endDate: string;
  workingDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decidedBy?: string | { _id: string; name: string };
  decisionComment?: string;
  createdAt: string;
}

export interface LeaveBalance {
  leaveType: {
    _id: string;
    name: string;
    code: string;
    isPaid: boolean;
    yearlyQuota: number | null;
  };
  quota: number | null;
  used: number;
  pending: number;
  remaining: number | null;
}

export interface PayrollRun {
  _id: string;
  month: string;
  status: 'draft' | 'finalized';
  totalGross: number;
  totalDeductions: number;
  totalTax: number;
  totalNet: number;
  employeeCount: number;
  finalizedAt?: string;
}

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  isPinned: boolean;
  authorId: string | { _id: string; name: string; role: string };
  createdAt: string;
}

export interface InAppNotification {
  _id: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  _id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
}

export type ToastType = 'success' | 'warning' | 'danger' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}
