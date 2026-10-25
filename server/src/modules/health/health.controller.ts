import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, {
    status: 'healthy',
    time: new Date().toISOString(),
  });
}
