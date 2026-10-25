import { Request, Response } from 'express';
import { userService } from './user.service';
import { sendSuccess } from '../../utils/response';

export async function createHrUser(req: Request, res: Response): Promise<void> {
  const result = await userService.createHrUser(req.body, req);
  sendSuccess(res, result, 201);
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const result = await userService.list({
    role: req.query.role as string,
    isActive: req.query.isActive as string,
    search: req.query.search as string,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  sendSuccess(res, result.users, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
  });
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const user = await userService.getById(String(req.params.id));
  sendSuccess(res, user);
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const user = await userService.updateUser(String(req.params.id), req.body, req);
  sendSuccess(res, user);
}

export async function deactivateUser(req: Request, res: Response): Promise<void> {
  const user = await userService.setUserActive(String(req.params.id), false, req.user!, req);
  sendSuccess(res, user);
}

export async function activateUser(req: Request, res: Response): Promise<void> {
  const user = await userService.setUserActive(String(req.params.id), true, req.user!, req);
  sendSuccess(res, user);
}

export async function resetUserPassword(req: Request, res: Response): Promise<void> {
  const result = await userService.resetPasswordByAdmin(String(req.params.id), req);
  sendSuccess(res, result);
}
