import { Request, Response } from 'express';
import { leaveTypeService } from './leave-type.service';
import { sendSuccess } from '../../utils/response';

export async function createLeaveType(req: Request, res: Response): Promise<void> {
  const leaveType = await leaveTypeService.create(req.body, req);
  sendSuccess(res, leaveType, 201);
}

export async function listLeaveTypes(req: Request, res: Response): Promise<void> {
  const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
  const leaveTypes = await leaveTypeService.list(isActive);
  sendSuccess(res, leaveTypes);
}

export async function getLeaveTypeById(req: Request, res: Response): Promise<void> {
  const leaveType = await leaveTypeService.getById(String(req.params.id));
  sendSuccess(res, leaveType);
}

export async function updateLeaveType(req: Request, res: Response): Promise<void> {
  const leaveType = await leaveTypeService.update(String(req.params.id), req.body, req);
  sendSuccess(res, leaveType);
}

export async function deactivateLeaveType(req: Request, res: Response): Promise<void> {
  const leaveType = await leaveTypeService.setActive(String(req.params.id), false, req);
  sendSuccess(res, leaveType);
}

export async function activateLeaveType(req: Request, res: Response): Promise<void> {
  const leaveType = await leaveTypeService.setActive(String(req.params.id), true, req);
  sendSuccess(res, leaveType);
}

export async function getSuggestions(_req: Request, res: Response): Promise<void> {
  const suggestions = leaveTypeService.getSuggestions();
  sendSuccess(res, suggestions);
}

export async function applySuggestions(req: Request, res: Response): Promise<void> {
  const result = await leaveTypeService.applySuggestions(req);
  sendSuccess(res, result);
}
