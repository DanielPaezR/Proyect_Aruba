import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as reportsService from "./reports.service";
import * as reportsExportService from "./reports.export.service";
import { exportReportQuerySchema, performanceReportQuerySchema } from "./reports.validators";

export const getPerformance = asyncHandler(async (req: Request, res: Response) => {
  const query = performanceReportQuerySchema.parse(req.query);
  const report = await reportsService.getPerformanceReport(query);
  res.json(report);
});

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const query = exportReportQuerySchema.parse(req.query);
  const file = await reportsExportService.generateReportExport(req.user!, query);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
});
