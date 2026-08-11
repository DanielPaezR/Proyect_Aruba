import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as projectsService from "./projects.service";
import { createProjectSchema, listProjectsQuerySchema, updateProjectSchema } from "./projects.validators";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = listProjectsQuerySchema.parse(req.query);
  const projects = await projectsService.listProjects(req.user!, filters);
  res.json({ projects });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectsService.getProject(req.user!, req.params.projectId);
  res.json({ project });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createProjectSchema.parse(req.body);
  const project = await projectsService.createProject(req.user!.id, input);
  res.status(201).json({ project });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateProjectSchema.parse(req.body);
  const project = await projectsService.updateProject(req.params.projectId, input);
  res.json({ project });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await projectsService.deleteProject(req.params.projectId);
  res.status(204).send();
});
