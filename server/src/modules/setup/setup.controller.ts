import { Request, Response } from 'express';
import { setupService } from './setup.service';
import { sendSuccess } from '../../utils/response';

export async function getSetupStatus(_req: Request, res: Response): Promise<void> {
  const status = await setupService.getStatus();
  sendSuccess(res, status);
}

export async function setupCompany(req: Request, res: Response): Promise<void> {
  const result = await setupService.setupCompany(req.body, req);
  sendSuccess(res, result, 201);
}
