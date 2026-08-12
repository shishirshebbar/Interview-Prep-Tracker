import { TaskStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { TrackerRepository } from "../lib/repository.js";

const dailyPlanQuerySchema = z.object({
  date: z.string().date().default("2026-08-11"),
});

const updateDailyTaskBodySchema = z.object({
  status: z.nativeEnum(TaskStatus),
});

export async function registerDailyPlanRoutes(
  app: FastifyInstance,
  repository: TrackerRepository,
) {
  app.get("/api/daily-plan", async (request, reply) => {
    const query = dailyPlanQuerySchema.parse(request.query);
    const plan = await repository.getDailyPlan(query.date);

    if (!plan) {
      return reply.code(404).send({
        message: "Daily plan not found",
      });
    }

    return plan;
  });

  app.patch("/api/daily-plan/tasks/:id", async (request, reply) => {
    const params = z
      .object({
        id: z.string().min(1),
      })
      .parse(request.params);
    const body = updateDailyTaskBodySchema.parse(request.body);
    const updated = await repository.updateDailyTaskStatus(params.id, body);

    if (!updated) {
      return reply.code(404).send({
        message: "Daily task not found",
      });
    }

    return updated;
  });
}
