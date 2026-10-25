import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { aiService } from './ai.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export class AiController {
  chat = asyncHandler(async (req: Request, res: Response) => {
    const { message, history } = req.body;
    const context = {
      userId: req.user!.id,
      role: req.user!.role,
      employeeId: req.user!.employeeId?.toString(),
    };

    const result = await aiService.chat(message, history || [], context);
    sendSuccess(res, result);
  });

  getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.body;
    const context = {
      userId: req.user!.id,
      role: req.user!.role,
    };

    const result = await aiService.getDashboardSummary(filters, context);
    sendSuccess(res, result);
  });

  smartLeave = asyncHandler(async (req: Request, res: Response) => {
    const { text } = req.body;
    if (!req.user?.employeeId) {
      throw AppError.forbidden('Only employees can use smart leave');
    }
    const context = {
      userId: req.user!.id,
      role: req.user!.role,
      employeeId: req.user!.employeeId?.toString(),
    };

    const result = await aiService.smartLeave(text, context);
    sendSuccess(res, result);
  });
}

export const aiController = new AiController();
