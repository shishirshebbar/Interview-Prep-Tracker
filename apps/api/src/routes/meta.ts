import {
  currentStudySummary,
  defaultStudySchedule,
  interviewPriorities,
} from "@tracker/shared";
import type { FastifyInstance } from "fastify";

export async function registerMetaRoutes(app: FastifyInstance) {
  app.get("/api/meta", async () => {
    return {
      app: "Learning Tracker",
      schedule: defaultStudySchedule,
      priorities: interviewPriorities,
      seedSummary: currentStudySummary,
    };
  });
}
