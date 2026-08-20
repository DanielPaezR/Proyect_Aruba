import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as payrollService from "./payroll.service";
import { generatePayrollSchema, listPayrollQuerySchema, previewPayrollQuerySchema } from "./payroll.validators";

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const query = previewPayrollQuerySchema.parse(req.query);
  const preview = await payrollService.previewPayroll(query);
  res.json({ preview });
});

export const generate = asyncHandler(async (req: Request, res: Response) => {
  const input = generatePayrollSchema.parse(req.body);
  const payrollRun = await payrollService.generatePayroll(req.user!.id, input);
  res.status(201).json({ payrollRun });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = listPayrollQuerySchema.parse(req.query);
  const payrollRuns = await payrollService.listPayroll(query);
  res.json({ payrollRuns });
});

export const markPaid = asyncHandler(async (req: Request, res: Response) => {
  const payrollRun = await payrollService.markPayrollPaid(req.params.id);
  res.json({ payrollRun });
});
