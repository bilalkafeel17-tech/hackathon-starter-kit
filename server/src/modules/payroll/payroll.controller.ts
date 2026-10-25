import { Request, Response } from 'express';
import { payrollService } from './payroll.service';
import { PayrollRun, PayrollItem } from './payroll.model';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export async function generateRun(req: Request, res: Response): Promise<void> {
  const result = await payrollService.generateRun(req.body.month, req.user!, req);
  sendSuccess(res, result, 201);
}

export async function listRuns(_req: Request, res: Response): Promise<void> {
  const runs = await PayrollRun.find()
    .populate('createdBy', 'name email')
    .populate('finalizedBy', 'name email')
    .sort({ month: -1 });
  sendSuccess(res, runs);
}

export async function getRunById(req: Request, res: Response): Promise<void> {
  const run = await PayrollRun.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('finalizedBy', 'name email');

  if (!run) {
    throw AppError.notFound('PayrollRun');
  }

  const items = await PayrollItem.find({ runId: run._id })
    .populate('employeeId', 'employeeCode name email joiningDate')
    .sort({ 'employeeId.name': 1 });

  sendSuccess(res, { run, items });
}

export async function finalizeRun(req: Request, res: Response): Promise<void> {
  const result = await payrollService.finalizeRun(req.params.id as string, req.user!, req);
  sendSuccess(res, result);
}

export async function adjustItem(req: Request, res: Response): Promise<void> {
  const result = await payrollService.adjustItem(
    req.params.id as string,
    req.params.itemId as string,
    req.body,
    req
  );
  sendSuccess(res, result);
}

export async function listPayslips(req: Request, res: Response): Promise<void> {
  const result = await payrollService.listPayslips(req.user as any, req.query);
  sendSuccess(res, result.payslips, 200, result.meta);
}

export async function getPayslip(req: Request, res: Response): Promise<void> {
  const result = await payrollService.getPayslip(req.params.id as string, req.user as any);
  sendSuccess(res, result);
}

export async function getPayslipPdf(req: Request, res: Response): Promise<void> {
  const pdfBuffer = await payrollService.getPayslipPdf(req.params.id as string, req.user as any);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="payslip-${req.params.id}.pdf"`);
  res.status(200).send(pdfBuffer);
}
