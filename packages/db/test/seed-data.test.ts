import { describe, expect, it } from "vitest";
import { dailyPlanSeed, problemSeed, topicSeed } from "../src/seed-data.js";

describe("db seed data", () => {
  it("keeps DSA as the first top-level roadmap area", () => {
    expect(topicSeed[0]?.slug).toBe("dsa");
  });

  it("includes the current string-work plan items", () => {
    const titles = problemSeed.map((problem) => problem.title);

    expect(titles).toContain("Longest Common Prefix");
    expect(titles).toContain("Isomorphic Strings");
  });

  it("captures the adaptive-planning example for today", () => {
    expect(dailyPlanSeed.tasks).toHaveLength(5);
    expect(dailyPlanSeed.tasks[0]?.actualMinutes).toBe(40);
    expect(dailyPlanSeed.tasks[1]?.status).toBe("SKIPPED");
  });
});
