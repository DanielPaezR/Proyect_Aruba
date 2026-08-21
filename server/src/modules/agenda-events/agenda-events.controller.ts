import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as agendaEventsService from "./agenda-events.service";
import {
  createAgendaEventSchema,
  listAgendaEventsQuerySchema,
  updateAgendaEventSchema,
} from "./agenda-events.validators";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = listAgendaEventsQuerySchema.parse(req.query);
  const events = await agendaEventsService.listAgendaEvents(req.user!, from, to);
  res.json({ events });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createAgendaEventSchema.parse(req.body);
  const event = await agendaEventsService.createAgendaEvent(req.user!, input);
  res.status(201).json({ event });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateAgendaEventSchema.parse(req.body);
  const event = await agendaEventsService.updateAgendaEvent(req.user!, req.params.eventId, input);
  res.json({ event });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await agendaEventsService.deleteAgendaEvent(req.user!, req.params.eventId);
  res.status(204).send();
});
