import { Request, Response } from 'express';
import { authService } from './auth.service';
import { sendSuccess } from '../../utils/response';

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body, req);
  sendSuccess(res, result);
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const userData: Record<string, any> = user.toJSON ? user.toJSON() : { ...user };

  if (user.role === 'employee' && user.employeeId) {
    const { Employee } = await import('../employees/employee.model');
    const emp = await Employee.findById(user.employeeId).select(
      'employeeCode name departmentId designationId status'
    );
    if (emp) {
      userData.employee = {
        id: emp._id,
        code: emp.employeeCode,
        name: emp.name,
        departmentId: emp.departmentId,
        designationId: emp.designationId,
        status: emp.status,
      };
    }
  }

  sendSuccess(res, userData);
}

export async function logout(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, { message: 'Logged out successfully' });
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  const result = await authService.logoutAll(req.user!._id, req);
  sendSuccess(res, result);
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const result = await authService.changePassword(req.user!._id, req.body, req);
  sendSuccess(res, result);
}
