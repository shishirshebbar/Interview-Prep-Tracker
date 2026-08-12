import { DifficultyLevel, ProblemStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { TrackerRepository } from "../lib/repository.js";

const listProblemsQuerySchema = z.object({
  topic: z.string().optional(),
  status: z.nativeEnum(ProblemStatus).optional(),
  difficulty: z.nativeEnum(DifficultyLevel).optional(),
  platform: z.string().optional(),
});

const updateProblemStatusBodySchema = z.object({
  status: z.nativeEnum(ProblemStatus),
});

const createProblemAttemptBodySchema = z.object({
  statusAfterAttempt: z.nativeEnum(ProblemStatus),
  wasSuccessful: z.boolean(),
  durationMinutes: z.number().int().positive().optional(),
  confidenceScore: z.number().int().min(1).max(5).optional(),
  notes: z.string().trim().min(1).optional(),
  solutionApproach: z.string().trim().min(1).optional(),
  mistakes: z.string().trim().min(1).optional(),
});

export async function registerProblemRoutes(
  app: FastifyInstance,
  repository: TrackerRepository,
) {
  app.get("/api/problems", async (request) => {
    const query = listProblemsQuerySchema.parse(request.query);
    return repository.listProblems(query);
  });

  app.patch("/api/problems/:id/status", async (request, reply) => {
    const params = z
      .object({
        id: z.string().min(1),
      })
      .parse(request.params);
    const body = updateProblemStatusBodySchema.parse(request.body);
    const updated = await repository.updateProblemStatus(
      params.id,
      body.status,
    );

    if (!updated) {
      return reply.code(404).send({
        message: "Problem not found",
      });
    }

    return updated;
  });

  app.post("/api/problems/:id/attempt", async (request, reply) => {
    const params = z
      .object({
        id: z.string().min(1),
      })
      .parse(request.params);
    const body = createProblemAttemptBodySchema.parse(request.body);
    const updated = await repository.createProblemAttempt(params.id, body);

    if (!updated) {
      return reply.code(404).send({
        message: "Problem not found",
      });
    }

    return updated;
  });
}
