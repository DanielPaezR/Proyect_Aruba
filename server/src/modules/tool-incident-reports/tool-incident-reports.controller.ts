import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as toolIncidentReportsService from "./tool-incident-reports.service";
import {
  createToolIncidentReportSchema,
  listToolIncidentReportsQuerySchema,
  resolveToolIncidentReportSchema,
} from "./tool-incident-reports.validators";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = listToolIncidentReportsQuerySchema.parse(req.query);
  const reports = await toolIncidentReportsService.listToolIncidentReports(filters);
  res.json({ reports });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createToolIncidentReportSchema.parse(req.body);
  const report = await toolIncidentReportsService.createToolIncidentReport(req.user!, input);
  res.status(201).json({ report });
});

export const resolve = asyncHandler(async (req: Request, res: Response) => {
  const input = resolveToolIncidentReportSchema.parse(req.body);
  const report = await toolIncidentReportsService.resolveToolIncidentReport(req.params.reportId, input);
  res.json({ report });
});
