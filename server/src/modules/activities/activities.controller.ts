import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as activitiesService from "./activities.service";
import {
  assignWorkerSchema,
  createActivitySchema,
  listActivitiesQuerySchema,
  updateActivitySchema,
  updateActivityStatusSchema,
} from "./activities.validators";

export const listForProject = asyncHandler(async (req: Request, res: Response) => {
  const filters = listActivitiesQuerySchema.parse(req.query);
  const activities = await activitiesService.listActivitiesForProject(req.user!, req.params.projectId, filters);
  res.json({ activities });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const filters = listActivitiesQuerySchema.parse(req.query);
  const activities = await activitiesService.listMyActivities(req.user!.id, filters);
  res.json({ activities });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const activity = await activitiesService.getActivity(req.user!, req.params.activityId);
  res.json({ activity });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createActivitySchema.parse(req.body);
  const activity = await activitiesService.createActivity(req.params.projectId, input);
  res.status(201).json({ activity });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateActivitySchema.parse(req.body);
  const activity = await activitiesService.updateActivity(req.params.activityId, input);
  res.json({ activity });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await activitiesService.deleteActivity(req.params.activityId);
  res.status(204).send();
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = updateActivityStatusSchema.parse(req.body);
  const activity = await activitiesService.updateActivityStatus(req.user!, req.params.activityId, status);
  res.json({ activity });
});

export const assignWorker = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = assignWorkerSchema.parse(req.body);
  const assignment = await activitiesService.assignWorker(req.params.activityId, userId);
  res.status(201).json({ assignment });
});

export const unassignWorker = asyncHandler(async (req: Request, res: Response) => {
  await activitiesService.unassignWorker(req.params.activityId, req.params.userId);
  res.status(204).send();
});
