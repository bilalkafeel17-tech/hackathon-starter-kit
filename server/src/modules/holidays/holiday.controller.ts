import { Request, Response } from 'express';
import { holidayService } from './holiday.service';
import { sendSuccess } from '../../utils/response';

export async function createHoliday(req: Request, res: Response): Promise<void> {
  const holiday = await holidayService.create(req.body, req);
  sendSuccess(res, holiday, 201);
}

export async function bulkCreateHolidays(req: Request, res: Response): Promise<void> {
  const result = await holidayService.bulkCreate(req.body, req);
  sendSuccess(res, result, 201);
}

export async function listHolidays(req: Request, res: Response): Promise<void> {
  const holidays = await holidayService.list({
    year: req.query.year as string,
    from: req.query.from as string,
    to: req.query.to as string,
    isActive: req.query.isActive as string,
  });
  sendSuccess(res, holidays);
}

export async function getHolidayById(req: Request, res: Response): Promise<void> {
  const holiday = await holidayService.getById(String(req.params.id));
  sendSuccess(res, holiday);
}

export async function updateHoliday(req: Request, res: Response): Promise<void> {
  const holiday = await holidayService.update(String(req.params.id), req.body, req);
  sendSuccess(res, holiday);
}

export async function deleteHoliday(req: Request, res: Response): Promise<void> {
  const result = await holidayService.delete(String(req.params.id), req);
  sendSuccess(res, result);
}
