import { Request, Response } from 'express';
import { departmentService } from './department.service';
import { sendSuccess } from '../../utils/response';

export async function createDepartment(req: Request, res: Response): Promise<void> {
  const department = await departmentService.create(req.body, req);
  sendSuccess(res, department, 201);
}

export async function listDepartments(req: Request, res: Response): Promise<void> {
  const result = await departmentService.list({
    isActive: req.query.isActive as string,
    search: req.query.search as string,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  sendSuccess(res, result.departments, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
  });
}

export async function getDepartmentById(req: Request, res: Response): Promise<void> {
  const department = await departmentService.getById(String(req.params.id));
  sendSuccess(res, department);
}

export async function updateDepartment(req: Request, res: Response): Promise<void> {
  const department = await departmentService.update(String(req.params.id), req.body, req);
  sendSuccess(res, department);
}

export async function deactivateDepartment(req: Request, res: Response): Promise<void> {
  const department = await departmentService.setActive(String(req.params.id), false, req);
  sendSuccess(res, department);
}

export async function activateDepartment(req: Request, res: Response): Promise<void> {
  const department = await departmentService.setActive(String(req.params.id), true, req);
  sendSuccess(res, department);
}
