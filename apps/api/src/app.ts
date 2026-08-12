import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { type TrackerRepository, prismaRepository } from "./lib/repository.js";
import { registerDailyPlanRoutes } from "./routes/daily-plan.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMetaRoutes } from "./routes/meta.js";
import { registerProblemRoutes } from "./routes/problems.js";
import { registerRevisionRoutes } from "./routes/revisions.js";
import { registerTopicRoutes } from "./routes/topics.js";

interface BuildAppOptions {
  repository?: TrackerRepository;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });
  const repository = options.repository ?? prismaRepository;

  await app.register(cors, {
    origin: true,
  });

  await registerHealthRoutes(app);
  await registerMetaRoutes(app);
  await registerDashboardRoutes(app, repository);
  await registerTopicRoutes(app, repository);
  await registerProblemRoutes(app, repository);
  await registerDailyPlanRoutes(app, repository);
  await registerRevisionRoutes(app, repository);

  return app;
}
