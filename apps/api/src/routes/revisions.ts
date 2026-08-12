import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { TrackerRepository } from "../lib/repository.js";

const dueRevisionQuerySchema = z.object({
  date: z.string().date().default("2026-08-11"),
});

export async function registerRevisionRoutes(
  app: FastifyInstance,
  repository: TrackerRepository,
) {
  app.get("/api/revisions/due", async (request) => {
    const query = dueRevisionQuerySchema.parse(request.query);
    return repository.getDueRevisions(query.date);
  });
}
