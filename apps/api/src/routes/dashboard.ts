import type { FastifyInstance } from "fastify";
import type { TrackerRepository } from "../lib/repository.js";

export async function registerDashboardRoutes(
  app: FastifyInstance,
  repository: TrackerRepository,
) {
  app.get("/api/dashboard", async () => {
    return repository.getDashboard();
  });
}
