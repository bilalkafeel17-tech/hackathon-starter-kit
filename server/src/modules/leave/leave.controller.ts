import { Request, Response } from 'express';
import { leaveService } from './leave.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export async function applyLeave(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.forbidden('Only employees can apply for leave');
  }
  const result = await leaveService.applyLeave(
    req.user.employeeId.toString(),
    req.body,
    req
  );
  sendSuccess(res, result, 201);
}

export async function getMyLeaves(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.forbidden('No employee profile associated with account');
  }
  const result = await leaveService.listLeaves(
    { role: 'employee', employeeId: req.user.employeeId },
    req.query
  );
  sendSuccess(res, result.leaves, 200, result.meta);
}

export async function getBalance(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.forbidden('No employee profile associated with account');
  }
  const year = req.query.year ? Number(req.query.year) : undefined;
  const result = await leaveService.getBalances(req.user.employeeId.toString(), year);
  sendSuccess(res, result);
}

export async function listLeaves(req: Request, res: Response): Promise<void> {
  const result = await leaveService.listLeaves(req.user as any, req.query);
  sendSuccess(res, result.leaves, 200, result.meta);
}

export async function cancelLeave(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.forbidden('Only employees can cancel leave');
  }
  const result = await leaveService.cancelLeave(
    req.params.id as string,
    req.user.employeeId.toString(),
    req
  );
  sendSuccess(res, result);
}

export async function approveLeave(req: Request, res: Response): Promise<void> {
  const result = await leaveService.approveLeave(
    req.params.id as string,
    req.user!,
    req.body.comment,
    req
  );
  sendSuccess(res, result);
}

export async function rejectLeave(req: Request, res: Response): Promise<void> {
  const result = await leaveService.rejectLeave(
    req.params.id as string,
    req.user!,
    req.body.comment,
    req
  );
  sendSuccess(res, result);
}
