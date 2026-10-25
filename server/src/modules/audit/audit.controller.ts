import { Request, Response } from 'express';
import { auditService } from './audit.service';
import { sendSuccess } from '../../utils/response';

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const result = await auditService.list({
    actorId: req.query.actorId as string,
    action: req.query.action as string,
    entity: req.query.entity as string,
    from: req.query.from as string,
    to: req.query.to as string,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  sendSuccess(res, result.logs, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
  });
}
