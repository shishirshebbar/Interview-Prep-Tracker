import { currentDateInTimeZone } from "@tracker/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import type { TrackerRepository } from "../lib/repository.js";

const dueRevisionQuerySchema = z.object({
  date: z.string().date().optional(),
});

export async function registerRevisionRoutes(
  app: FastifyInstance,
  repository: TrackerRepository,
) {
  app.get("/api/revisions/due", async (request) => {
    const query = dueRevisionQuerySchema.parse(request.query);
    return repository.getDueRevisions(
      query.date ?? currentDateInTimeZone(env.TIMEZONE),
    );
  });

  app.patch("/api/revisions/:id/complete", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const completed = await repository.completeRevision(params.id);
    if (!completed) {
      return reply.code(404).send({ message: "Revision not found" });
    }
    return { id: params.id, status: "COMPLETED" };
  });
}
