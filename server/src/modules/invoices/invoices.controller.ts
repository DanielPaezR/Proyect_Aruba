import type { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";
import { asyncHandler } from "../../utils/asyncHandler";
import * as invoicesService from "./invoices.service";
import { listInvoicesQuerySchema, returnInvoiceSchema } from "./invoices.validators";

export const listForProject = asyncHandler(async (req: Request, res: Response) => {
  const invoices = await invoicesService.listForProject(req.params.projectId);
  res.json({ invoices });
});

export const listAll = asyncHandler(async (req: Request, res: Response) => {
  const filters = listInvoicesQuerySchema.parse(req.query);
  const invoices = await invoicesService.listAll(filters);
  res.json({ invoices });
});

export const upload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest(ErrorCode.FILE_REQUIRED, "Falta el archivo (campo 'file')");
  }
  const invoice = await invoicesService.uploadInvoice(req.user!.id, req.params.projectId, req.file);
  res.status(201).json({ invoice });
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoicesService.approveInvoice(req.user!.id, req.params.invoiceId);
  res.json({ invoice });
});

export const returnInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { comment } = returnInvoiceSchema.parse(req.body);
  const invoice = await invoicesService.returnInvoice(req.user!.id, req.params.invoiceId, comment);
  res.json({ invoice });
});

export const resubmit = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest(ErrorCode.FILE_REQUIRED, "Falta el archivo (campo 'file')");
  }
  const invoice = await invoicesService.resubmitInvoice(req.params.invoiceId, req.file);
  res.json({ invoice });
});
