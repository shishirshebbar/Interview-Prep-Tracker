import type { FastifyInstance } from "fastify";
import type { TrackerRepository } from "../lib/repository.js";

export async function registerTopicRoutes(
  app: FastifyInstance,
  repository: TrackerRepository,
) {
  app.get("/api/topics", async () => {
    return repository.listTopics();
  });
}
