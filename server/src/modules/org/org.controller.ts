import { Request, Response } from 'express';
import { orgService } from './org.service';
import { sendSuccess } from '../../utils/response';

export async function getReadiness(_req: Request, res: Response): Promise<void> {
  const readiness = await orgService.getReadiness();
  sendSuccess(res, readiness);
}
