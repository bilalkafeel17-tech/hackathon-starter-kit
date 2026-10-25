import { Request, Response } from 'express';
import { designationService } from './designation.service';
import { sendSuccess } from '../../utils/response';

export async function createDesignation(req: Request, res: Response): Promise<void> {
  const designation = await designationService.create(req.body, req);
  sendSuccess(res, designation, 201);
}

export async function listDesignations(req: Request, res: Response): Promise<void> {
  const result = await designationService.list({
    departmentId: req.query.departmentId as string,
    isActive: req.query.isActive as string,
    search: req.query.search as string,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  sendSuccess(res, result.designations, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
  });
}

export async function getDesignationById(req: Request, res: Response): Promise<void> {
  const designation = await designationService.getById(String(req.params.id));
  sendSuccess(res, designation);
}

export async function updateDesignation(req: Request, res: Response): Promise<void> {
  const designation = await designationService.update(String(req.params.id), req.body, req);
  sendSuccess(res, designation);
}

export async function deactivateDesignation(req: Request, res: Response): Promise<void> {
  const designation = await designationService.setActive(String(req.params.id), false, req);
  sendSuccess(res, designation);
}

export async function activateDesignation(req: Request, res: Response): Promise<void> {
  const designation = await designationService.setActive(String(req.params.id), true, req);
  sendSuccess(res, designation);
}
