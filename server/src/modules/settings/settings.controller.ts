import { Request, Response } from 'express';
import { settingsService } from './settings.service';
import { sendSuccess } from '../../utils/response';

export async function getSettings(_req: Request, res: Response): Promise<void> {
  const settings = await settingsService.get();
  sendSuccess(res, settings);
}

export async function getPublicSettings(_req: Request, res: Response): Promise<void> {
  const publicSettings = await settingsService.getPublic();
  sendSuccess(res, publicSettings);
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  const updated = await settingsService.update(req.body, req);
  sendSuccess(res, updated);
}
