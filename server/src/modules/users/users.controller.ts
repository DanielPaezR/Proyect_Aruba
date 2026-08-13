import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as usersService from "./users.service";

export const locations = asyncHandler(async (_req: Request, res: Response) => {
  const workers = await usersService.listWorkerLocations();
  res.json({
    note: "Última ubicación conocida reportada por cada trabajador — no es rastreo en tiempo real.",
    workers,
  });
});
