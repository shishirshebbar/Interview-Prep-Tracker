import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createTestRepository } from "./fixtures.js";

describe("api", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      repository: createTestRepository(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns health", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "api",
    });
  });

  it("returns seed metadata", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/meta",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("schedule");
    expect(response.json()).toHaveProperty("seedSummary");
  });

  it("returns dashboard data", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      overallCompletionPercentage: 42,
      dueRevisionCount: 1,
    });
  });

  it("returns topics", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/topics",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });

  it("filters problems by topic", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/problems?topic=strings",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          topicSlug: "strings",
        }),
      ]),
    );
  });

  it("updates a problem status", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/problems/problem-1/status",
      payload: {
        status: "IN_PROGRESS",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "problem-1",
      status: "IN_PROGRESS",
    });
  });

  it("records a problem attempt", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/problems/problem-1/attempt",
      payload: {
        statusAfterAttempt: "SOLVED",
        wasSuccessful: true,
        durationMinutes: 25,
        confidenceScore: 4,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "problem-1",
      status: "SOLVED",
      attemptsCount: 1,
      confidenceScore: 4,
    });
  });

  it("returns the requested daily plan", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/daily-plan?date=2026-08-11",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      planDate: "2026-08-11",
      availableMinutes: 90,
    });
  });

  it("generates a plan for a date without one", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/daily-plan/generate",
      payload: {
        date: "2026-08-12",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      planDate: "2026-08-12",
      availableMinutes: 90,
      plannedStudyMinutes: 90,
    });
  });

  it("updates a daily task status", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/daily-plan/tasks/task-1",
      payload: {
        status: "COMPLETED",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "task-1",
      status: "COMPLETED",
      actualMinutes: 40,
    });
  });

  it("records partial progress on a daily task", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/daily-plan/tasks/task-1",
      payload: {
        status: "PARTIALLY_COMPLETED",
        actualMinutes: 12,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "task-1",
      status: "PARTIALLY_COMPLETED",
      actualMinutes: 12,
    });
  });

  it("returns due revisions", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/revisions/due?date=2026-08-11",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          problem: expect.objectContaining({
            title: "Nth Highest Salary",
          }),
        }),
      ]),
    );
  });

  it("completes a due revision", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/revisions/revision-1/complete",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: "revision-1",
      status: "COMPLETED",
    });
  });
});
