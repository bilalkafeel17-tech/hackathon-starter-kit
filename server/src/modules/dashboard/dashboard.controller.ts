import { Request, Response } from 'express';
import { analyticsService } from './analytics.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export async function getHrDashboard(req: Request, res: Response): Promise<void> {
  const result = await analyticsService.getHrDashboard(req.query);
  sendSuccess(res, result);
}

export async function getAdminDashboard(req: Request, res: Response): Promise<void> {
  const result = await analyticsService.getAdminDashboard(req.query);
  sendSuccess(res, result);
}

export async function getEmployeeDashboard(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.forbidden('Only active employees can view employee dashboard');
  }
  const result = await analyticsService.getEmployeeDashboard(
    req.user.employeeId.toString(),
    req.user._id.toString()
  );
  sendSuccess(res, result);
}
