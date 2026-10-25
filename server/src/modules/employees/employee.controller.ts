import { Request, Response } from 'express';
import { employeeService } from './employee.service';
import { salaryService } from './salary.service';
import { csvService } from './csv.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export async function registerEmployee(req: Request, res: Response): Promise<void> {
  const result = await employeeService.registerEmployee(req.body, req);
  sendSuccess(res, result, 201);
}

export async function listEmployees(req: Request, res: Response): Promise<void> {
  const result = await employeeService.list(req.query, req.user as any);
  sendSuccess(res, result.employees, 200, result.meta);
}

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.notFound('No employee profile associated with current user');
  }
  const employee = await employeeService.getById(
    req.user.employeeId.toString(),
    req.user as any
  );
  sendSuccess(res, employee);
}

export async function getEmployeeById(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.getById(req.params.id as string, req.user as any);
  sendSuccess(res, employee);
}

export async function updateSelfContact(req: Request, res: Response): Promise<void> {
  if (!req.user?.employeeId) {
    throw AppError.notFound('No employee profile associated with current user');
  }
  const updated = await employeeService.updateSelfContact(
    req.user.employeeId.toString(),
    req.body,
    req
  );
  sendSuccess(res, updated);
}

export async function updateEmployee(req: Request, res: Response): Promise<void> {
  const updated = await employeeService.update(req.params.id as string, req.body, req);
  sendSuccess(res, updated);
}

export async function exitEmployee(req: Request, res: Response): Promise<void> {
  const exited = await employeeService.exitEmployee(req.params.id as string, req.body, req);
  sendSuccess(res, exited);
}

export async function getEmployee360(req: Request, res: Response): Promise<void> {
  const result = await employeeService.getEmployee360(req.params.id as string, req.user as any);
  sendSuccess(res, result);
}

export async function updateSalary(req: Request, res: Response): Promise<void> {
  const result = await salaryService.updateSalary(req.params.id as string, req.body, req);
  sendSuccess(res, result);
}

export async function getSalary(req: Request, res: Response): Promise<void> {
  const current = await salaryService.getCurrent(req.params.id as string);
  const history = await salaryService.getHistory(req.params.id as string);
  sendSuccess(res, { current, history });
}

export async function getImportTemplate(_req: Request, res: Response): Promise<void> {
  const template = csvService.getTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="employee_import_template.csv"');
  res.status(200).send(template);
}

export async function importEmployees(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw AppError.unprocessable('No CSV file uploaded. Please upload a file with field name "file".');
  }

  const dryRun = req.query.dryRun === 'true';
  const result = await csvService.processImport(
    req.file.buffer,
    dryRun,
    req.file.originalname,
    req
  );

  sendSuccess(res, result, dryRun ? 200 : 201);
}

export async function exportEmployees(req: Request, res: Response): Promise<void> {
  const { csv } = await csvService.exportEmployees(req.query, req);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="employees_export.csv"');
  res.status(200).send(csv);
}
