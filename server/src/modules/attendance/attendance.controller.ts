import { Request, Response } from 'express';
import { attendanceService } from './attendance.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import { todayInCompanyTz } from '../../utils/date';

export async function checkIn(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.forbidden('Only employees can check in');
  }
  const result = await attendanceService.checkIn(
    req.user.employeeId.toString(),
    req.body,
    req
  );
  sendSuccess(res, result, 201);
}

export async function checkOut(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.forbidden('Only employees can check out');
  }
  const result = await attendanceService.checkOut(
    req.user.employeeId.toString(),
    req.body,
    req
  );
  sendSuccess(res, result, 200);
}

export async function getToday(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.forbidden('No employee profile associated with account');
  }
  const result = await attendanceService.getToday(req.user.employeeId.toString());
  sendSuccess(res, result);
}

export async function getMyAttendance(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.forbidden('No employee profile associated with account');
  }
  const result = await attendanceService.getMy(
    req.user.employeeId.toString(),
    req.query.month as string | undefined
  );
  sendSuccess(res, result);
}

export async function getBoard(req: Request, res: Response): Promise<void> {
  const dateKey = (req.query.date as string) || todayInCompanyTz();
  const departmentId = req.query.departmentId as string | undefined;
  const status = req.query.status as string | undefined;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;

  const result = await attendanceService.getBoard(dateKey, departmentId, status, page, limit);
  sendSuccess(res, result.items, 200, result.meta);
}

export async function createCorrection(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.forbidden('Only employees can submit attendance corrections');
  }
  const result = await attendanceService.createCorrection(
    req.user.employeeId.toString(),
    req.body,
    req
  );
  sendSuccess(res, result, 201);
}

export async function listCorrections(req: Request, res: Response): Promise<void> {
  const status = req.query.status as string | undefined;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;

  const result = await attendanceService.listCorrections(
    req.user as any,
    status,
    page,
    limit
  );
  sendSuccess(res, result.corrections, 200, result.meta);
}

export async function approveCorrection(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.approveCorrection(
    req.params.id as string,
    req.user!,
    req.body,
    req
  );
  sendSuccess(res, result);
}

export async function rejectCorrection(req: Request, res: Response): Promise<void> {
  const result = await attendanceService.rejectCorrection(
    req.params.id as string,
    req.user!,
    req.body,
    req
  );
  sendSuccess(res, result);
}
