import { TaskStatus } from "@prisma/client";
import { currentDateInTimeZone } from "@tracker/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import type { TrackerRepository } from "../lib/repository.js";

const dailyPlanQuerySchema = z.object({
  date: z.string().date().optional(),
});

const updateDailyTaskBodySchema = z.object({
  status: z.nativeEnum(TaskStatus),
  actualMinutes: z.number().int().min(0).optional(),
});

export async function registerDailyPlanRoutes(
  app: FastifyInstance,
  repository: TrackerRepository,
) {
  app.get("/api/daily-plan", async (request, reply) => {
    const query = dailyPlanQuerySchema.parse(request.query);
    const date = query.date ?? currentDateInTimeZone(env.TIMEZONE);
    return (
      (await repository.getDailyPlan(date)) ??
      (await repository.generateDailyPlan(date))
    );
  });

  app.post("/api/daily-plan/generate", async (request) => {
    const body = dailyPlanQuerySchema.parse(request.body ?? {});
    return repository.generateDailyPlan(
      body.date ?? currentDateInTimeZone(env.TIMEZONE),
    );
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
