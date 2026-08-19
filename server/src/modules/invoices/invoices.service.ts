import { InvoiceStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { deleteInvoiceFile, uploadInvoiceFile } from "../../config/storage";
import { ApiError } from "../../utils/ApiError";
import { ErrorCode } from "../../utils/errorCodes";

const invoiceInclude = {
  uploadedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const;

async function ensureProjectExists(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) {
    throw ApiError.notFound(ErrorCode.PROJECT_NOT_FOUND, "Proyecto no encontrado");
  }
}

async function getInvoiceOrThrow(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    throw ApiError.notFound(ErrorCode.INVOICE_NOT_FOUND, "Factura no encontrada");
  }
  return invoice;
}

export async function listForProject(projectId: string) {
  await ensureProjectExists(projectId);

  return prisma.invoice.findMany({
    where: { projectId },
    include: invoiceInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** Cola de trabajo de Administrador/Gerente: todas las facturas (filtrables por status) de todos los proyectos. */
export async function listAll(filters: { status?: InvoiceStatus }) {
  return prisma.invoice.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      ...invoiceInclude,
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function uploadInvoice(userId: string, projectId: string, file: Express.Multer.File) {
  await ensureProjectExists(projectId);

  const uploaded = await uploadInvoiceFile(file.buffer);

  return prisma.invoice.create({
    data: {
      projectId,
      uploadedById: userId,
      fileUrl: uploaded.url,
      filePublicId: uploaded.publicId,
    },
    include: invoiceInclude,
  });
}

export async function approveInvoice(reviewerId: string, invoiceId: string) {
  const invoice = await getInvoiceOrThrow(invoiceId);

  if (invoice.status !== InvoiceStatus.PENDIENTE_REVISION) {
    throw ApiError.forbidden(
      ErrorCode.INVALID_INVOICE_TRANSITION,
      "Solo se puede aprobar una factura pendiente de revisión",
    );
  }

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: InvoiceStatus.APROBADA,
      reviewComment: null,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
    include: invoiceInclude,
  });
}

export async function returnInvoice(reviewerId: string, invoiceId: string, comment: string) {
  const invoice = await getInvoiceOrThrow(invoiceId);

  if (invoice.status !== InvoiceStatus.PENDIENTE_REVISION) {
    throw ApiError.forbidden(
      ErrorCode.INVALID_INVOICE_TRANSITION,
      "Solo se puede devolver una factura pendiente de revisión",
    );
  }

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: InvoiceStatus.DEVUELTA,
      reviewComment: comment,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
    include: invoiceInclude,
  });
}

/** Supervisor resube el PDF corregido de una factura DEVUELTA: reemplaza el
 * archivo (borra el anterior de Cloudinary, best-effort) y reinicia el ciclo
 * de revision — vuelve a PENDIENTE_REVISION, limpia el comentario anterior. */
export async function resubmitInvoice(invoiceId: string, file: Express.Multer.File) {
  const invoice = await getInvoiceOrThrow(invoiceId);

  if (invoice.status !== InvoiceStatus.DEVUELTA) {
    throw ApiError.forbidden(
      ErrorCode.INVALID_INVOICE_TRANSITION,
      "Solo se puede resubir una factura devuelta",
    );
  }

  const uploaded = await uploadInvoiceFile(file.buffer);

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      fileUrl: uploaded.url,
      filePublicId: uploaded.publicId,
      status: InvoiceStatus.PENDIENTE_REVISION,
      reviewComment: null,
      reviewedById: null,
      reviewedAt: null,
    },
    include: invoiceInclude,
  });

  try {
    await deleteInvoiceFile(invoice.filePublicId);
  } catch (error) {
    console.error(`No se pudo borrar la factura anterior de Cloudinary (public_id ${invoice.filePublicId}):`, error);
  }

  return updated;
}
